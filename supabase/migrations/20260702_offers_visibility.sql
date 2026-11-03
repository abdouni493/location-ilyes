-- Prompt 1 : visibilité des voitures sur le site + extension des offres spéciales.
-- Changements purement ADDITIFS — aucune donnée existante n'est modifiée ou supprimée.
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas exécuter de DDL).

-- 1) Visibilité d'une voiture sur le site public.
--    false par défaut = toutes les voitures existantes restent visibles.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS is_hidden_from_site BOOLEAN NOT NULL DEFAULT false;

-- 2) Extension des offres spéciales (promotions liées à une voiture existante).
--    is_active existant sert de toggle "affiché / masqué du site".
ALTER TABLE public.special_offers
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- 3) Table `offers` (offres ordinaires) : DÉPRÉCIÉE mais CONSERVÉE.
--    Vérifiée le 2026-07-02 : elle contient 0 ligne, il n'y a donc rien à migrer.
--    L'application ne lit/n'écrit plus cette table ; les voitures s'affichent
--    désormais automatiquement sur le site (sauf is_hidden_from_site = true).
