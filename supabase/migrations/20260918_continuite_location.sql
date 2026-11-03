-- ============================================================================
-- MHD AUTO — CONTINUITÉ DE LOCATION (prolongation) — 2026-09-18
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Script ADDITIF et IDEMPOTENT : rejouable sans risque,
-- aucune donnée existante n'est supprimée.
--
-- OBJECTIF
--   Permettre de PROLONGER une location active : le client garde la voiture
--   N jours de plus. L'agence saisit ces jours supplémentaires, la réservation
--   passe au statut « continued » (location continuée), les jours ajoutés sont
--   facturés SÉPARÉMENT et viennent grossir la DETTE du client.
--
--   Règle métier — le coût de la prolongation est INDÉPENDANT : il ne
--   recalcule JAMAIS les jours déjà facturés. Chaque prolongation est une
--   ligne autonome (jours ajoutés × tarif journalier), imprimée sur un
--   « contrat de continuité » distinct du contrat initial.
--
-- CE SCRIPT
--   1) élargit la contrainte CHECK de `status` au nouveau statut 'continued' ;
--   2) ajoute les colonnes de suivi sur `reservations` ;
--   3) crée la table `reservation_continuations` (une ligne par prolongation) ;
--   4) RLS + trigger multi-agences sur cette table ;
--   5) inclut 'continued' dans les RPC de disponibilité (anti double-booking) ;
--   6) met à jour l'email d'envoi des documents -> mhdauto16@gmail.com.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) CONTRAINTE CHECK DE status : AUTORISER 'continued'
-- ============================================================================
-- On supprime DYNAMIQUEMENT toute contrainte CHECK portant sur `status`
-- (robuste quel que soit son nom auto-généré), puis on la recrée élargie.
-- `payment_status` est explicitement épargnée (contrainte distincte).
DO $mig$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.reservations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $mig$;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status = ANY (ARRAY[
    'website_reservation'::text,
    'pending'::text,
    'accepted'::text,
    'confirmed'::text,
    'active'::text,
    'continued'::text,
    'completed'::text,
    'terminated'::text,
    'cancelled'::text
  ]));


-- ============================================================================
-- 2) COLONNES DE SUIVI SUR reservations
-- ============================================================================
--   continuation_days      : TOTAL des jours ajoutés (affiché sur la carte) ;
--   continuation_amount    : TOTAL facturé au titre des prolongations ;
--   continuation_count     : nombre de prolongations successives ;
--   original_return_date   : date de retour AVANT la 1re prolongation ;
--   original_total_days    : durée initiale (jours) avant prolongation ;
--   original_total_price   : montant initial avant prolongation ;
--   last_continued_at      : horodatage de la dernière prolongation.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS continuation_days    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS continuation_amount  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS continuation_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_return_date date,
  ADD COLUMN IF NOT EXISTS original_total_days  integer,
  ADD COLUMN IF NOT EXISTS original_total_price numeric,
  ADD COLUMN IF NOT EXISTS last_continued_at    timestamptz;


-- ============================================================================
-- 3) TABLE reservation_continuations — une ligne par prolongation
-- ============================================================================
-- Chaque ligne est AUTONOME : elle porte ses propres jours, son propre tarif
-- journalier et son propre total. Le contrat de continuité s'imprime à partir
-- de cette seule ligne — les jours du contrat initial n'y figurent jamais.
CREATE TABLE IF NOT EXISTS public.reservation_continuations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id       uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  company_id           uuid,
  -- Numéro d'ordre de la prolongation (1 = première).
  sequence_number      integer NOT NULL DEFAULT 1,
  -- Jours ajoutés et leur facturation (INDÉPENDANTE du contrat initial).
  added_days           integer NOT NULL CHECK (added_days > 0),
  price_per_day        numeric NOT NULL DEFAULT 0,
  total_price          numeric NOT NULL DEFAULT 0,
  -- Période couverte par CES jours supplémentaires uniquement.
  previous_return_date date,
  new_return_date      date,
  return_time          time,
  -- Part immédiatement encaissée (0 = tout part en dette).
  paid_amount          numeric NOT NULL DEFAULT 0,
  payment_method       text,
  notes                text,
  created_by           text,
  created_by_name      text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_res_continuations_reservation
  ON public.reservation_continuations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_res_continuations_company
  ON public.reservation_continuations(company_id);


-- ============================================================================
-- 4) MULTI-AGENCES : trigger company_id + RLS
-- ============================================================================
-- Même règle que les réservations : chaque agence ne voit QUE ses propres
-- prolongations ; le super-admin voit tout.
DO $mig$
BEGIN
  IF to_regproc('public.set_company_id_from_auth()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_set_company_id ON public.reservation_continuations;
    CREATE TRIGGER trg_set_company_id
      BEFORE INSERT ON public.reservation_continuations
      FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_auth();
  END IF;
END $mig$;

ALTER TABLE public.reservation_continuations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rc_select_auth ON public.reservation_continuations;
DROP POLICY IF EXISTS rc_insert_auth ON public.reservation_continuations;
DROP POLICY IF EXISTS rc_update_auth ON public.reservation_continuations;
DROP POLICY IF EXISTS rc_delete_auth ON public.reservation_continuations;

-- Lecture / écriture réservées aux comptes authentifiés. Le cloisonnement par
-- agence est appliqué côté requête (`scopeQuery`) ET ici dès que les fonctions
-- d'aide multi-agences existent.
DO $mig$
DECLARE
  scoped boolean := to_regproc('public.auth_company_id()') IS NOT NULL
                AND to_regproc('public.auth_is_super_admin()') IS NOT NULL;
  cond   text;
BEGIN
  cond := CASE WHEN scoped
    THEN '(public.auth_is_super_admin() OR company_id IS NOT DISTINCT FROM public.auth_company_id())'
    ELSE 'true'
  END;

  EXECUTE format(
    'CREATE POLICY rc_select_auth ON public.reservation_continuations FOR SELECT TO authenticated USING (%s)', cond);
  EXECUTE format(
    'CREATE POLICY rc_insert_auth ON public.reservation_continuations FOR INSERT TO authenticated WITH CHECK (%s)', cond);
  EXECUTE format(
    'CREATE POLICY rc_update_auth ON public.reservation_continuations FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', cond, cond);
  EXECUTE format(
    'CREATE POLICY rc_delete_auth ON public.reservation_continuations FOR DELETE TO authenticated USING (%s)', cond);
END $mig$;


-- ============================================================================
-- 5) DISPONIBILITÉ : une location CONTINUÉE bloque toujours la voiture
-- ============================================================================
-- Sans cela, une voiture prolongée redeviendrait « disponible » sur le site
-- public et pourrait être double-réservée.
CREATE OR REPLACE FUNCTION public.get_unavailable_car_ids(p_from date, p_to date)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $fn$
  SELECT DISTINCT r.car_id
  FROM public.reservations r
  WHERE r.status IN ('website_reservation', 'pending', 'accepted', 'confirmed', 'active', 'continued')
    AND r.departure_date <= p_to
    AND r.return_date >= p_from;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_unavailable_car_ids(date, date) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_reserved_periods(p_car_id uuid)
RETURNS TABLE (departure_date text, return_date text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $fn$
  SELECT r.departure_date::text, r.return_date::text
  FROM public.reservations r
  WHERE r.car_id = p_car_id
    AND r.status IN ('website_reservation', 'pending', 'accepted', 'confirmed', 'active', 'continued');
$fn$;

GRANT EXECUTE ON FUNCTION public.get_reserved_periods(uuid) TO anon, authenticated;


-- ============================================================================
-- 6) EMAIL D'ENVOI DES DOCUMENTS -> mhdauto16@gmail.com
-- ============================================================================
-- L'expéditeur affiché dans « Envoyer un document » est lu depuis
-- `website_contacts.email`. On le met à jour ici ; si la table est vide, on
-- crée la ligne de contact.
DO $mig$
BEGIN
  IF to_regclass('public.website_contacts') IS NULL THEN
    RAISE NOTICE 'Table website_contacts absente - email non mis a jour.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.website_contacts) THEN
    UPDATE public.website_contacts SET email = 'mhdauto16@gmail.com';
  ELSE
    INSERT INTO public.website_contacts (email) VALUES ('mhdauto16@gmail.com');
  END IF;
END $mig$;

COMMIT;


-- ============================================================================
-- 7) VÉRIFICATION — à exécuter après coup
-- ============================================================================
-- SELECT status, count(*) FROM public.reservations GROUP BY status ORDER BY status;
--
-- SELECT r.id, r.status, r.continuation_days, r.continuation_amount,
--        r.total_days, r.total_price, r.remaining_payment
-- FROM public.reservations r
-- WHERE r.status = 'continued';
--
-- SELECT * FROM public.reservation_continuations ORDER BY created_at DESC LIMIT 20;
-- ============================================================================
