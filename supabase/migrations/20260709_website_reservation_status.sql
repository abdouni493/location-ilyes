-- ============================================================================
-- STATUT DÉDIÉ « website_reservation » POUR LES COMMANDES DU SITE — 2026-07-09
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Script AUTONOME, idempotent (ré-exécutable sans risque) :
-- il n'exige PAS que la migration 20260708 ait déjà tourné.
--
-- OBJECTIF
--   Donner aux commandes du site un statut distinct de 'pending' :
--
--     'website_reservation' = commande reçue du site, EN ATTENTE d'acceptation
--                             par l'agence. Visible UNIQUEMENT dans « Commandes
--                             Website », jamais dans le planificateur.
--
--   Cycle de vie :
--     website_reservation ──(agence accepte)──▶ pending    → planificateur (🌐)
--                          └─(agence annule)──▶ cancelled  → reste dans Commandes
--
-- Ce script :
--   0) ajoute la colonne `source` si absente (site web vs agence) ;
--   1) REMPLACE la contrainte CHECK de `status` pour autoriser le nouveau statut ;
--   2) tague les commandes site existantes (source='website') ;
--   3) convertit leurs statuts (pending → website_reservation, accepted → pending) ;
--   4) recrée la RPC create_website_reservation (source + nouveau statut) ;
--   5) met à jour les RPC de disponibilité pour inclure 'website_reservation'.
-- ============================================================================


-- ============================================================================
-- 0) COLONNE source (site web vs agence) — défaut 'agency' (aucune régression)
-- ============================================================================
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'agency';


-- ============================================================================
-- 1) CONTRAINTE CHECK DE status : AUTORISER 'website_reservation'
-- ============================================================================
-- On supprime DYNAMIQUEMENT toute contrainte CHECK portant sur `status`
-- (robuste quel que soit son nom auto-généré), puis on la recrée élargie.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.reservations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status = ANY (ARRAY[
    'website_reservation'::text,
    'pending'::text,
    'accepted'::text,
    'confirmed'::text,
    'active'::text,
    'completed'::text,
    'cancelled'::text
  ]));


-- ============================================================================
-- 2) TAGUER LES COMMANDES SITE EXISTANTES  (source = 'website')
-- ============================================================================
-- Les commandes du site sont créées par la RPC publique, qui ne renseigne
-- JAMAIS created_by / created_by_name (contrairement aux réservations créées
-- par un agent via l'interface admin). On ne touche qu'aux commandes encore
-- 'pending' ou 'accepted' (les confirmées/actives/terminées restent 'agency').
UPDATE public.reservations
SET source = 'website'
WHERE created_by IS NULL
  AND created_by_name IS NULL
  AND status IN ('pending', 'accepted');


-- ============================================================================
-- 3) CONVERTIR LES STATUTS DES COMMANDES SITE
-- ============================================================================
-- 3.a) Commandes site EN ATTENTE ('pending') → nouveau statut dédié.
--      Elles réapparaissent dans « Commandes Website », prêtes à être acceptées.
UPDATE public.reservations
SET status = 'website_reservation'
WHERE source = 'website'
  AND status = 'pending';

-- 3.b) Commandes site DÉJÀ ACCEPTÉES ('accepted') → 'pending'.
--      Elles restent visibles dans le planificateur (qui affiche les commandes
--      site 'pending') et n'encombrent plus « Commandes Website ».
UPDATE public.reservations
SET status = 'pending'
WHERE source = 'website'
  AND status = 'accepted';


-- ============================================================================
-- 4) RPC : CRÉER UNE RÉSERVATION DEPUIS LE SITE (statut 'website_reservation')
-- ============================================================================
-- La commande est insérée au statut 'website_reservation' + source 'website'.
-- Le contrôle de disponibilité inclut 'website_reservation' pour bloquer la
-- voiture dès la réception (anti double-booking avant acceptation).
CREATE OR REPLACE FUNCTION public.create_website_reservation(
  p_client jsonb,
  p_reservation jsonb,
  p_services jsonb DEFAULT '[]'::jsonb,
  p_promo_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_reservation_id uuid;
  v_car_id uuid;
  v_departure date;
  v_return date;
  v_promo public.promo_codes%ROWTYPE;
  v_service jsonb;
BEGIN
  v_car_id := (p_reservation->>'car_id')::uuid;
  v_departure := (p_reservation->>'departure_date')::date;
  v_return := (p_reservation->>'return_date')::date;

  -- Garde-fous basiques
  IF v_car_id IS NULL OR v_departure IS NULL OR v_return IS NULL THEN
    RAISE EXCEPTION 'INVALID_RESERVATION_DATA';
  END IF;
  IF v_return < v_departure THEN
    RAISE EXCEPTION 'INVALID_DATES';
  END IF;

  -- La voiture ne doit pas être déjà réservée sur la période demandée.
  -- 'website_reservation' inclus : une commande en attente d'acceptation
  -- bloque déjà la voiture (on évite deux commandes sur les mêmes dates).
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.car_id = v_car_id
      AND r.status IN ('website_reservation', 'pending', 'accepted', 'confirmed', 'active')
      AND r.departure_date <= v_return
      AND r.return_date >= v_departure
  ) THEN
    RAISE EXCEPTION 'CAR_UNAVAILABLE';
  END IF;

  -- Code promo : verrouille + consomme atomiquement (anti double utilisation)
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE upper(code) = upper(trim(p_promo_code))
    FOR UPDATE;

    IF NOT FOUND OR v_promo.is_used OR NOT v_promo.is_active THEN
      RAISE EXCEPTION 'PROMO_CODE_INVALID';
    END IF;
  END IF;

  -- 1) Client
  INSERT INTO public.clients (
    first_name, last_name, phone, email,
    date_of_birth, place_of_birth, id_card_number,
    license_number, license_expiration_date, license_delivery_date, license_delivery_place,
    document_type, document_number, document_delivery_date, document_expiration_date, document_delivery_address,
    wilaya, complete_address, profile_photo, scanned_documents
  ) VALUES (
    coalesce(p_client->>'first_name', ''),
    coalesce(p_client->>'last_name', ''),
    coalesce(p_client->>'phone', ''),
    NULLIF(p_client->>'email', ''),
    NULLIF(p_client->>'date_of_birth', '')::date,
    NULLIF(p_client->>'place_of_birth', ''),
    NULLIF(p_client->>'id_card_number', ''),
    coalesce(p_client->>'license_number', ''),
    NULLIF(p_client->>'license_expiration_date', '')::date,
    NULLIF(p_client->>'license_delivery_date', '')::date,
    NULLIF(p_client->>'license_delivery_place', ''),
    coalesce(NULLIF(p_client->>'document_type', ''), 'none'),
    NULLIF(p_client->>'document_number', ''),
    NULLIF(p_client->>'document_delivery_date', '')::date,
    NULLIF(p_client->>'document_expiration_date', '')::date,
    NULLIF(p_client->>'document_delivery_address', ''),
    coalesce(p_client->>'wilaya', ''),
    NULLIF(p_client->>'complete_address', ''),
    NULLIF(p_client->>'profile_photo', ''),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_client->'scanned_documents', '[]'::jsonb))),
      '{}'::text[]
    )
  )
  RETURNING id INTO v_client_id;

  -- 2) Réservation : statut TOUJOURS 'website_reservation', source 'website'
  INSERT INTO public.reservations (
    client_id, car_id,
    departure_date, departure_time, departure_agency_id,
    return_date, return_time, return_agency_id,
    price_per_day, price_week, price_month,
    total_days, total_price, deposit,
    discount_amount, discount_type,
    advance_payment, remaining_payment,
    notes, status, source,
    protection_assurance_id, protection_assurance_name, protection_assurance_price
  ) VALUES (
    v_client_id,
    v_car_id,
    v_departure,
    coalesce(NULLIF(p_reservation->>'departure_time', ''), '10:00')::time,
    (p_reservation->>'departure_agency_id')::uuid,
    v_return,
    coalesce(NULLIF(p_reservation->>'return_time', ''), '10:00')::time,
    (p_reservation->>'return_agency_id')::uuid,
    coalesce((p_reservation->>'price_per_day')::numeric, 0),
    NULLIF(p_reservation->>'price_week', '')::numeric,
    NULLIF(p_reservation->>'price_month', '')::numeric,
    coalesce((p_reservation->>'total_days')::integer, 1),
    coalesce((p_reservation->>'total_price')::numeric, 0),
    coalesce((p_reservation->>'deposit')::numeric, 0),
    coalesce((p_reservation->>'discount_amount')::numeric, 0),
    coalesce(NULLIF(p_reservation->>'discount_type', ''), 'fixed'),
    0,
    coalesce((p_reservation->>'total_price')::numeric, 0),
    NULLIF(p_reservation->>'notes', ''),
    'website_reservation',
    'website',
    NULLIF(p_reservation->>'protection_assurance_id', '')::uuid,
    NULLIF(p_reservation->>'protection_assurance_name', ''),
    coalesce((p_reservation->>'protection_assurance_price')::numeric, 0)
  )
  RETURNING id INTO v_reservation_id;

  -- 3) Services additionnels
  FOR v_service IN SELECT * FROM jsonb_array_elements(coalesce(p_services, '[]'::jsonb))
  LOOP
    INSERT INTO public.reservation_services (reservation_id, category, service_name, description, price)
    VALUES (
      v_reservation_id,
      coalesce(NULLIF(v_service->>'category', ''), 'service'),
      coalesce(v_service->>'service_name', ''),
      NULLIF(v_service->>'description', ''),
      coalesce((v_service->>'price')::numeric, 0)
    );
  END LOOP;

  -- 4) Consommation du code promo (marqué UTILISÉ + lié à la réservation)
  IF v_promo.id IS NOT NULL THEN
    UPDATE public.promo_codes
    SET is_used = true,
        used_at = now(),
        reservation_id = v_reservation_id
    WHERE id = v_promo.id;
  END IF;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'client_id', v_client_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_website_reservation(jsonb, jsonb, jsonb, text) TO anon, authenticated;


-- ============================================================================
-- 5) RPC DISPONIBILITÉ : inclure 'website_reservation'
-- ============================================================================
-- Une commande reçue mais pas encore acceptée doit rendre la voiture
-- indisponible côté site (recherche + calendrier), sinon deux clients
-- pourraient réserver les mêmes dates avant l'arbitrage de l'agence.

CREATE OR REPLACE FUNCTION public.get_unavailable_car_ids(p_from date, p_to date)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT r.car_id
  FROM public.reservations r
  WHERE r.status IN ('website_reservation', 'pending', 'accepted', 'confirmed', 'active')
    AND r.departure_date <= p_to
    AND r.return_date >= p_from;
$$;

GRANT EXECUTE ON FUNCTION public.get_unavailable_car_ids(date, date) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_reserved_periods(p_car_id uuid)
RETURNS TABLE (departure_date text, return_date text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.departure_date::text, r.return_date::text
  FROM public.reservations r
  WHERE r.car_id = p_car_id
    AND r.status IN ('website_reservation', 'pending', 'accepted', 'confirmed', 'active');
$$;

GRANT EXECUTE ON FUNCTION public.get_reserved_periods(uuid) TO anon, authenticated;


-- ============================================================================
-- 6) VÉRIFICATION — exécuter après coup pour contrôler la répartition
-- ============================================================================
-- SELECT source, status, count(*)
-- FROM public.reservations
-- GROUP BY source, status
-- ORDER BY source, status;
--
-- Attendu :
--   • source='website', status='website_reservation'  → commandes à traiter
--   • source='website', status='pending'               → commandes acceptées (planificateur)
--   • source='website', status='cancelled'             → commandes refusées
--   • source='agency',  status=...                      → réservations agence (inchangées)


-- ============================================================================
-- Fin. Les commandes du site utilisent 'website_reservation' et passent
-- 'pending' (planificateur) uniquement après acceptation par l'agence.
-- ============================================================================
