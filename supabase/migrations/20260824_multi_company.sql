-- ============================================================================
-- MHD AUTO — MULTI-AGENCES (companies) — 2026-08-24
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Script ADDITIF et IDEMPOTENT : ré-exécutable sans risque,
-- aucune donnée existante n'est supprimée. Sûr à relancer même si une version
-- antérieure a déjà été appliquée.
--
-- CONCEPT
--   « company » = agence MÉTIER indépendante (comptabilité + employés propres).
--   À NE PAS confondre avec « agencies » (agences physiques départ/retour) qui
--   restent inchangées. Les tables PARTAGÉES (cars, offers, special_offers,
--   services, website_settings, website_contacts, protection_assurances,
--   agencies) ne sont PAS scoppées : le site public continue de tout lire.
--
-- CONTENU
--   1)  Tables : companies, car_companies, app_users
--   2)  Agence principale (#1) : garantie d'existence
--   3)  Colonne company_id sur les tables métier + FK
--   4)  Backfill des lignes existantes vers l'agence principale
--   5)  app_users : les connexions existantes = super-admin de l'agence #1
--   6)  Fonctions auth_company_id() / auth_is_super_admin()
--   7)  Trigger d'auto-remplissage de company_id (BEFORE INSERT)
--   8)  RLS : companies, car_companies, app_users
--   (Le cloisonnement des tables métier est assuré côté application — voir la
--    note en fin de fichier ; pas de RLS « authenticated only » qui casserait
--    les sessions employés « anon ».)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  logo        text,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lien plusieurs-à-plusieurs voiture <-> agence : une voiture peut appartenir
-- à une OU deux agences. (cars reste une table partagée.)
CREATE TABLE IF NOT EXISTS public.car_companies (
  car_id      uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (car_id, company_id)
);

-- Rattache chaque connexion Supabase Auth à son agence + statut super-admin.
CREATE TABLE IF NOT EXISTS public.app_users (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id     uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 2) AGENCE PRINCIPALE (#1)
-- ============================================================================
-- Crée une agence principale si AUCUNE agence n'existe encore.
INSERT INTO public.companies (name, is_primary)
SELECT 'Agence principale', true
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- Si des agences existent mais aucune n'est marquée principale, promeut la plus
-- ancienne (garantit que auth_company_id() / le backfill ont une cible).
UPDATE public.companies c
SET is_primary = true
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE is_primary)
  AND c.id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1);


-- ============================================================================
-- 3) COLONNE company_id SUR LES TABLES MÉTIER (+ FK)
-- ============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'reservations','clients','vehicle_expenses','store_expenses','payments',
    'workers','maintenance_alerts','document_templates','worker_advances',
    'worker_absences','worker_payments','worker_roles','promo_codes',
    'entreprises','rental_settings','agency_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)',
        'idx_' || t || '_company_id', t
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- 4) BACKFILL DES LIGNES EXISTANTES -> AGENCE PRINCIPALE
-- ============================================================================
DO $$
DECLARE
  pc uuid;
  t text;
  tables text[] := ARRAY[
    'clients','vehicle_expenses','store_expenses','payments',
    'workers','maintenance_alerts','document_templates','worker_advances',
    'worker_absences','worker_payments','worker_roles','promo_codes',
    'entreprises','rental_settings','agency_settings'
  ];
BEGIN
  SELECT id INTO pc FROM public.companies WHERE is_primary ORDER BY created_at ASC LIMIT 1;
  IF pc IS NULL THEN
    SELECT id INTO pc FROM public.companies ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF pc IS NOT NULL THEN
    -- Réservations : on NE touche PAS aux commandes du site non encore acceptées
    -- (status 'website_reservation') — elles restent NON rattachées (company_id
    -- NULL) jusqu'à leur acceptation par le super-admin.
    IF to_regclass('public.reservations') IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.reservations SET company_id = %L WHERE company_id IS NULL AND COALESCE(status, '''') <> ''website_reservation''',
        pc
      );
    END IF;

    FOREACH t IN ARRAY tables LOOP
      IF to_regclass('public.' || t) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, pc);
      END IF;
    END LOOP;
  END IF;
END $$;


-- ============================================================================
-- 5) app_users : CONNEXIONS EXISTANTES = SUPER-ADMIN DE L'AGENCE #1
-- ============================================================================
-- Toute connexion Supabase Auth existante qui N'EST PAS un employé (table
-- workers) devient super-admin de l'agence principale. Les employés ayant un
-- compte auth restent scoppés via workers.company_id (voir l'app). Les lignes
-- déjà présentes ne sont jamais écrasées (nouveaux admins d'agence protégés).
INSERT INTO public.app_users (user_id, company_id, is_super_admin)
SELECT u.id,
       (SELECT id FROM public.companies WHERE is_primary ORDER BY created_at ASC LIMIT 1),
       true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.app_users a WHERE a.user_id = u.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.workers w WHERE lower(w.email) = lower(u.email)
  );


-- ============================================================================
-- 6) FONCTIONS D'AIDE (SECURITY DEFINER : contournent la RLS de app_users)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.app_users WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.app_users WHERE user_id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.auth_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_super_admin() TO anon, authenticated;


-- ============================================================================
-- 7) TRIGGER : AUTO-REMPLISSAGE DE company_id (BEFORE INSERT)
-- ============================================================================
-- Si company_id est NULL à l'insertion, on le renseigne avec l'agence de
-- l'appelant. Filet de sécurité : l'app estampille déjà explicitement la valeur.
CREATE OR REPLACE FUNCTION public.set_company_id_from_auth()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.auth_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'reservations','clients','vehicle_expenses','store_expenses','payments',
    'workers','maintenance_alerts','document_templates','worker_advances',
    'worker_absences','worker_payments','worker_roles','promo_codes',
    'entreprises','rental_settings','agency_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_auth()',
        t
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- 8) RLS — TABLES companies / car_companies / app_users
-- ============================================================================
ALTER TABLE public.companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users     ENABLE ROW LEVEL SECURITY;

-- companies : lisible par les utilisateurs authentifiés (switcher, formulaire
-- voiture, création d'admin) ; écriture réservée au super-admin. Pas d'accès
-- anon (évite d'exposer la liste des agences sur la page de connexion).
DROP POLICY IF EXISTS mc_companies_select ON public.companies;
CREATE POLICY mc_companies_select ON public.companies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mc_companies_insert ON public.companies;
CREATE POLICY mc_companies_insert ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.auth_is_super_admin());

DROP POLICY IF EXISTS mc_companies_update ON public.companies;
CREATE POLICY mc_companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING (public.auth_is_super_admin())
  WITH CHECK (public.auth_is_super_admin());

DROP POLICY IF EXISTS mc_companies_delete ON public.companies;
CREATE POLICY mc_companies_delete ON public.companies
  FOR DELETE TO authenticated USING (public.auth_is_super_admin());

-- car_companies : lisible par tous (listing admin + workers) ; écriture par le
-- super-admin ou l'admin de l'agence concernée.
DROP POLICY IF EXISTS mc_car_companies_select ON public.car_companies;
CREATE POLICY mc_car_companies_select ON public.car_companies
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS mc_car_companies_insert ON public.car_companies;
CREATE POLICY mc_car_companies_insert ON public.car_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_super_admin() OR company_id = public.auth_company_id());

DROP POLICY IF EXISTS mc_car_companies_delete ON public.car_companies;
CREATE POLICY mc_car_companies_delete ON public.car_companies
  FOR DELETE TO authenticated
  USING (public.auth_is_super_admin() OR company_id = public.auth_company_id());

-- app_users : chacun lit sa propre ligne ; le super-admin lit et gère tout
-- (nécessaire à la création d'un admin d'agence).
DROP POLICY IF EXISTS mc_app_users_select ON public.app_users;
CREATE POLICY mc_app_users_select ON public.app_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.auth_is_super_admin());

DROP POLICY IF EXISTS mc_app_users_insert ON public.app_users;
CREATE POLICY mc_app_users_insert ON public.app_users
  FOR INSERT TO authenticated WITH CHECK (public.auth_is_super_admin());

DROP POLICY IF EXISTS mc_app_users_update ON public.app_users;
CREATE POLICY mc_app_users_update ON public.app_users
  FOR UPDATE TO authenticated
  USING (public.auth_is_super_admin())
  WITH CHECK (public.auth_is_super_admin());

DROP POLICY IF EXISTS mc_app_users_delete ON public.app_users;
CREATE POLICY mc_app_users_delete ON public.app_users
  FOR DELETE TO authenticated USING (public.auth_is_super_admin());


COMMIT;

-- ============================================================================
-- SÉPARATION DES DONNÉES PAR AGENCE — MODÈLE RETENU
-- ============================================================================
-- Le cloisonnement des tables MÉTIER (réservations, clients, dépenses,
-- maintenance, employés, rapports, comptabilité…) est assuré par la COUCHE
-- APPLICATIVE : chaque lecture est filtrée par `company_id` et chaque écriture
-- est estampillée sur l'agence active (voir src/utils/companyContext.ts).
--
-- On N'ACTIVE PAS de RLS company-scoped « authenticated only » sur ces tables,
-- car les EMPLOYÉS se connectent via une session « worker » (RPC login_worker)
-- SANS session Supabase Auth : leurs requêtes passent par le rôle « anon ».
-- Une RLS réservée au rôle « authenticated » les priverait de tout accès et
-- casserait l'agence actuelle. Le trigger `set_company_id_from_auth` +
-- l'estampillage applicatif garantissent que chaque ligne porte son agence ;
-- le super-admin voit tout, un admin/employé scoppé ne voit que son agence.
--
-- Les tables companies / car_companies / app_users (section 8) SONT protégées
-- par RLS car elles ne sont manipulées que par des utilisateurs authentifiés.
-- ============================================================================
