-- ============================================================================
-- MHD AUTO — TYPES DE DÉPENSES PERSONNALISÉS (MAINTENANCE) — 2026-08-17
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Script ADDITIF et IDEMPOTENT : ré-exécutable sans risque,
-- aucune donnée existante n'est supprimée.
--
-- OBJECTIF
--   La page Maintenance ne se limite plus aux 5 types codés en dur
--   (vidange / chaîne / assurance / contrôle / autre). L'utilisateur crée ses
--   propres types depuis la même interface — « Bougies » est livré par défaut —
--   avec le même suivi kilométrique que la vidange. Chaque dépense saisie
--   atterrit dans `vehicle_expenses` : elle apparaît donc automatiquement dans
--   l'historique du véhicule côté page Dépenses, la fiche véhicule et les
--   rapports.
--
-- CE QUE FAIT CE SCRIPT
--   1. Crée la table `maintenance_types` (+ RLS + trigger updated_at).
--   2. Insère les types système, dont le nouveau type « Bougies ».
--   3. Ouvre la colonne `vehicle_expenses.type` (texte libre) pour accepter
--      les clés des types personnalisés.
--   4. Complète `vehicle_expenses` avec les colonnes de suivi manquantes.
--   5. Ajoute les index de lecture.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. TABLE DES TYPES DE MAINTENANCE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clé technique stockée dans vehicle_expenses.type (ex : 'bougies').
  key                   text NOT NULL UNIQUE,
  label_fr              text NOT NULL,
  label_ar              text NOT NULL DEFAULT '',
  icon                  text NOT NULL DEFAULT '🔧',
  -- 'mileage' = compte à rebours en KM · 'date' = échéance · 'simple' = sans suivi
  tracking              text NOT NULL DEFAULT 'mileage'
                          CHECK (tracking IN ('mileage', 'date', 'simple')),
  default_interval_km   integer,
  default_interval_days integer,
  color                 text NOT NULL DEFAULT 'slate'
                          CHECK (color IN ('red','blue','amber','green','purple',
                                           'teal','orange','indigo','pink','slate')),
  -- Les types système ne sont pas supprimables depuis l'application.
  is_system             boolean NOT NULL DEFAULT false,
  is_active             boolean NOT NULL DEFAULT true,
  sort_order            integer NOT NULL DEFAULT 100,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.maintenance_types IS
  'Types de dépenses véhicule (système + personnalisés) utilisés par les pages Maintenance et Dépenses.';

CREATE INDEX IF NOT EXISTS idx_maintenance_types_sort
  ON public.maintenance_types (is_active, sort_order);

-- Rafraîchit updated_at à chaque modification.
CREATE OR REPLACE FUNCTION public.set_maintenance_types_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maintenance_types_updated_at ON public.maintenance_types;
CREATE TRIGGER trg_maintenance_types_updated_at
  BEFORE UPDATE ON public.maintenance_types
  FOR EACH ROW EXECUTE FUNCTION public.set_maintenance_types_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS — mêmes règles que les autres tables métier
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_types_select" ON public.maintenance_types;
DROP POLICY IF EXISTS "maintenance_types_insert" ON public.maintenance_types;
DROP POLICY IF EXISTS "maintenance_types_update" ON public.maintenance_types;
DROP POLICY IF EXISTS "maintenance_types_delete" ON public.maintenance_types;

-- Lecture ouverte à l'anon : le site public affiche aussi des libellés.
CREATE POLICY "maintenance_types_select"
  ON public.maintenance_types FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "maintenance_types_insert"
  ON public.maintenance_types FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "maintenance_types_update"
  ON public.maintenance_types FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Seuls les types personnalisés peuvent être supprimés.
CREATE POLICY "maintenance_types_delete"
  ON public.maintenance_types FOR DELETE
  TO authenticated USING (is_system = false);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. TYPES LIVRÉS PAR DÉFAUT (dont « Bougies »)
--    ON CONFLICT DO NOTHING : les libellés déjà personnalisés sont préservés.
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.maintenance_types
  (key, label_fr, label_ar, icon, tracking, default_interval_km, default_interval_days, color, is_system, sort_order)
VALUES
  ('vidange',   'Vidange',              'تغيير الزيت',    '🛢️', 'mileage', 10000, NULL, 'amber',  true, 10),
  ('chaine',    'Chaîne / Distribution','السلسلة',        '⛓️', 'mileage', 60000, NULL, 'teal',   true, 20),
  ('bougies',   'Bougies',              'شمعات الإشعال',  '🔌', 'mileage', 30000, NULL, 'purple', true, 30),
  ('assurance', 'Assurance',            'التأمين',        '🛡️', 'date',    NULL,  365,  'blue',   true, 40),
  ('controle',  'Contrôle technique',   'الفحص الفني',    '🛠️', 'date',    NULL,  365,  'indigo', true, 50),
  ('autre',     'Autre',                'أخرى',           '❓', 'simple',  NULL,  NULL, 'slate',  true, 900)
ON CONFLICT (key) DO NOTHING;

-- Les 5 clés historiques restent des types système même si la table
-- pré-existait avec des lignes créées à la main.
UPDATE public.maintenance_types
   SET is_system = true
 WHERE key IN ('vidange', 'chaine', 'bougies', 'assurance', 'controle', 'autre');


-- ────────────────────────────────────────────────────────────────────────────
-- 4. OUVERTURE DE `vehicle_expenses.type`
--    La colonne n'accepte que les 5 valeurs historiques sur certaines bases
--    (CHECK ou enum). On la ramène à du texte libre : les clés des types
--    personnalisés doivent pouvoir y être écrites.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_data_type text;
  v_constraint record;
BEGIN
  SELECT data_type INTO v_data_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'vehicle_expenses'
     AND column_name  = 'type';

  IF v_data_type IS NULL THEN
    RAISE NOTICE 'Table vehicle_expenses absente : étape 4 ignorée.';
    RETURN;
  END IF;

  -- Enum ou varchar contraint → text
  IF v_data_type NOT IN ('text') THEN
    EXECUTE 'ALTER TABLE public.vehicle_expenses ALTER COLUMN type TYPE text USING type::text';
    RAISE NOTICE 'vehicle_expenses.type converti en text (était %).', v_data_type;
  END IF;

  -- Supprime les CHECK qui figeraient la liste des types.
  FOR v_constraint IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.vehicle_expenses'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ~ '\mtype\M'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicle_expenses DROP CONSTRAINT %I', v_constraint.conname);
    RAISE NOTICE 'Contrainte % supprimée sur vehicle_expenses.type.', v_constraint.conname;
  END LOOP;

  -- Un type reste obligatoire, mais sa valeur est désormais libre.
  EXECUTE 'ALTER TABLE public.vehicle_expenses ALTER COLUMN type SET DEFAULT ''autre''';
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. COLONNES DE SUIVI DE `vehicle_expenses`
--    Ajoutées seulement si absentes (bases installées avant ces champs).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS current_mileage     integer,
  -- Intervalle (en km) avant la prochaine échéance, pas une valeur absolue.
  ADD COLUMN IF NOT EXISTS next_vidange_km     integer,
  ADD COLUMN IF NOT EXISTS expiration_date     date,
  ADD COLUMN IF NOT EXISTS expense_name        text,
  ADD COLUMN IF NOT EXISTS oil_filter_changed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS air_filter_changed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fuel_filter_changed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ac_filter_changed   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vehicle_expenses.type IS
  'Clé du type (maintenance_types.key) : vidange, chaine, bougies… ou une clé personnalisée.';
COMMENT ON COLUMN public.vehicle_expenses.next_vidange_km IS
  'Intervalle en km avant la prochaine échéance. Échéance absolue = current_mileage + next_vidange_km.';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. INDEX DE LECTURE
--    L'historique par véhicule et le filtrage par type sont les deux accès
--    les plus fréquents des pages Maintenance / Dépenses.
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_car_date
  ON public.vehicle_expenses (car_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_type
  ON public.vehicle_expenses (type);


-- ============================================================================
-- VÉRIFICATIONS RAPIDES
-- ============================================================================
-- SELECT key, label_fr, tracking, default_interval_km, is_system
--   FROM public.maintenance_types ORDER BY sort_order;
--
-- SELECT type, count(*), sum(cost)
--   FROM public.vehicle_expenses GROUP BY type ORDER BY 2 DESC;
-- ============================================================================
