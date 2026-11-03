-- ============================================================================
-- PROTECTION ASSURANCE (assurances de protection) — nouveau module
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Changements purement ADDITIFS : aucune donnée existante
-- n'est modifiée ou supprimée.
--
-- Modèle :
--   protection_assurances          → un forfait (nom + prix/jour)
--   protection_assurance_items     → liste maîtresse d'items réutilisables
--   protection_assurance_item_links→ items d'un forfait avec statut vrai/faux
--   reservations.protection_*      → forfait sélectionné (snapshot) sur la résa
-- ============================================================================

-- 1) Forfaits d'assurance de protection ------------------------------------
CREATE TABLE IF NOT EXISTS public.protection_assurances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  price_per_day numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT protection_assurances_pkey PRIMARY KEY (id)
);

-- 2) Liste maîtresse d'items (comme inspection_checklist_items) -------------
CREATE TABLE IF NOT EXISTS public.protection_assurance_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  item_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT protection_assurance_items_pkey PRIMARY KEY (id)
);

-- 3) Items d'un forfait + statut (coché/décoché = vrai/faux) ----------------
CREATE TABLE IF NOT EXISTS public.protection_assurance_item_links (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  assurance_id uuid NOT NULL,
  item_id uuid NOT NULL,
  status boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT protection_assurance_item_links_pkey PRIMARY KEY (id),
  CONSTRAINT protection_assurance_item_links_assurance_fkey
    FOREIGN KEY (assurance_id) REFERENCES public.protection_assurances(id) ON DELETE CASCADE,
  CONSTRAINT protection_assurance_item_links_item_fkey
    FOREIGN KEY (item_id) REFERENCES public.protection_assurance_items(id) ON DELETE CASCADE,
  CONSTRAINT protection_assurance_item_links_unique UNIQUE (assurance_id, item_id)
);

-- 4) Forfait sélectionné sur une réservation (snapshot nom + prix/jour) ------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS protection_assurance_id uuid,
  ADD COLUMN IF NOT EXISTS protection_assurance_name text,
  ADD COLUMN IF NOT EXISTS protection_assurance_price numeric DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reservations_protection_assurance_fkey'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_protection_assurance_fkey
      FOREIGN KEY (protection_assurance_id)
      REFERENCES public.protection_assurances(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- RLS : lecture publique (site web anonyme) + écriture par les utilisateurs
--       connectés (interface admin), comme les tables `services`.
-- ============================================================================
ALTER TABLE public.protection_assurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_assurance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_assurance_item_links ENABLE ROW LEVEL SECURITY;

-- protection_assurances
DROP POLICY IF EXISTS "pa_select_public" ON public.protection_assurances;
DROP POLICY IF EXISTS "pa_write_auth"    ON public.protection_assurances;
CREATE POLICY "pa_select_public" ON public.protection_assurances
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pa_write_auth" ON public.protection_assurances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- protection_assurance_items
DROP POLICY IF EXISTS "pai_select_public" ON public.protection_assurance_items;
DROP POLICY IF EXISTS "pai_write_auth"    ON public.protection_assurance_items;
CREATE POLICY "pai_select_public" ON public.protection_assurance_items
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pai_write_auth" ON public.protection_assurance_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- protection_assurance_item_links
DROP POLICY IF EXISTS "pail_select_public" ON public.protection_assurance_item_links;
DROP POLICY IF EXISTS "pail_write_auth"    ON public.protection_assurance_item_links;
CREATE POLICY "pail_select_public" ON public.protection_assurance_item_links
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pail_write_auth" ON public.protection_assurance_item_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- Fin. Le module d'assurance de protection est prêt.
-- ============================================================================
