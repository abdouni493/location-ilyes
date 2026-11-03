-- ============================================================================
-- MHD AUTO — CORRECTIFS « NOUVELLE RÉSERVATION » + COMMISSIONS EMPLOYÉS
-- 2026-11-02
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase. Script ADDITIF et IDEMPOTENT :
-- rejouable sans risque, aucune donnée existante n'est supprimée.
--
--   1) reservations.caution_enabled    : la caution activée / désactivée est
--      enfin enregistrée (elle revenait toujours « activée »).
--   2) reservations.is_manual_price     : le prix modifié manuellement à la
--      création est conservé (l'inspection ne le recalcule plus).
--   3) table reservation_worker_commissions : commission (montant fixe ou %)
--      versée à l'employé ayant contribué à une réservation, payée tout de
--      suite (sortie de caisse agence) ou plus tard (acompte / paiement).
-- ============================================================================

BEGIN;

-- 1) + 2) Colonnes sur reservations ------------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS caution_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS is_manual_price boolean NOT NULL DEFAULT false;

-- 3) Commissions employés ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_worker_commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  worker_id         uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  worker_name       text,
  -- 'fixed' = montant fixe (DA) ; 'percentage' = % du total de la réservation
  commission_type   text NOT NULL DEFAULT 'fixed'
                    CHECK (commission_type IN ('fixed', 'percentage')),
  commission_value  numeric NOT NULL DEFAULT 0,
  base_amount       numeric NOT NULL DEFAULT 0,   -- total réservation servant au calcul
  amount            numeric NOT NULL DEFAULT 0,   -- montant final de la commission (DA)
  -- 'immediate' = payée à la création (sortie de caisse agence)
  -- 'deferred'  = mise sur le compte de l'employé (acompte / paiement normal)
  payout_mode       text NOT NULL DEFAULT 'immediate'
                    CHECK (payout_mode IN ('immediate', 'deferred')),
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid')),
  -- 'creation' | 'advance' | 'payment' : comment la commission a été réglée
  paid_via          text,
  paid_at           date,
  worker_payment_id uuid,
  worker_advance_id uuid,
  store_expense_id  uuid,
  note              text,
  created_by_name   text,
  company_id        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- FK company_id seulement si la table companies existe (multi-agences)
DO $mig$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rwc_company_id_fkey'
  ) THEN
    ALTER TABLE public.reservation_worker_commissions
      ADD CONSTRAINT rwc_company_id_fkey FOREIGN KEY (company_id)
      REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $mig$;

CREATE INDEX IF NOT EXISTS idx_rwc_reservation ON public.reservation_worker_commissions (reservation_id);
CREATE INDEX IF NOT EXISTS idx_rwc_worker      ON public.reservation_worker_commissions (worker_id);
CREATE INDEX IF NOT EXISTS idx_rwc_company     ON public.reservation_worker_commissions (company_id);

-- Trigger multi-agences (auto-remplissage de company_id)
DO $mig$
BEGIN
  IF to_regproc('public.set_company_id_from_auth()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_set_company_id ON public.reservation_worker_commissions;
    CREATE TRIGGER trg_set_company_id
      BEFORE INSERT ON public.reservation_worker_commissions
      FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_auth();
  END IF;
END $mig$;

-- RLS
ALTER TABLE public.reservation_worker_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rwc_select_auth ON public.reservation_worker_commissions;
DROP POLICY IF EXISTS rwc_insert_auth ON public.reservation_worker_commissions;
DROP POLICY IF EXISTS rwc_update_auth ON public.reservation_worker_commissions;
DROP POLICY IF EXISTS rwc_delete_auth ON public.reservation_worker_commissions;

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
  EXECUTE format('CREATE POLICY rwc_select_auth ON public.reservation_worker_commissions FOR SELECT TO authenticated USING (%s)', cond);
  EXECUTE format('CREATE POLICY rwc_insert_auth ON public.reservation_worker_commissions FOR INSERT TO authenticated WITH CHECK (%s)', cond);
  EXECUTE format('CREATE POLICY rwc_update_auth ON public.reservation_worker_commissions FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', cond, cond);
  EXECUTE format('CREATE POLICY rwc_delete_auth ON public.reservation_worker_commissions FOR DELETE TO authenticated USING (%s)', cond);
END $mig$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservation_worker_commissions TO authenticated;

COMMIT;

-- Recharge le cache de schéma PostgREST (nouvelles colonnes / table visibles)
NOTIFY pgrst, 'reload schema';
