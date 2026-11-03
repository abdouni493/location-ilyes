-- ============================================================================
-- MHD AUTO — MISE À JOUR MAJEURE — 2026-07-25
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Script ADDITIF et IDEMPOTENT : ré-exécutable sans risque,
-- aucune donnée existante n'est supprimée.
--
-- CONTENU
--   1)  cars : propriétaire du véhicule (personnel / tiers) + part agence
--   2)  cars : devises secondaires (USD / EUR / GBP) avec taux de change
--   3)  services : service obligatoire
--   4)  reservations : timbre fiscal, devise, code promo, entreprise, vol
--   5)  reservations : statut de paiement (dette soldée / partielle)
--   6)  entreprises : nouvelle table (RC / ART / NIS / NIF) + RLS
--   7)  rental_settings : limite de kilométrage globale + frais
--   8)  worker_roles : rôles d'employés créés par l'admin
--   9)  workers : rôle, carte d'identité, date d'entrée, permissions, compte
--   10) worker_advances / worker_absences : indicateur « déduit »
--   11) worker_payments : période couverte (mois ou jour)
--   12) RPC upsert_worker_auth_user / delete_worker_auth_user (comptes de
--       connexion des employés, écrits dans auth.users)
--   13) RPC create_website_reservation : devise + code promo + vol
--   14) verify_promo_code : code à usage unique (renforcé)
--   15) Bucket storage `inspection` : suppression des photos à la clôture
-- ============================================================================


-- ============================================================================
-- 1) PROPRIÉTÉ DU VÉHICULE
-- ============================================================================
-- 'personal'    : voiture de l'agence (défaut — aucune régression)
-- 'third_party' : voiture confiée par un propriétaire ; l'agence perçoit
--                 `agency_share_per_day` par jour loué, le reste va au tiers.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS agency_share_per_day numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cars'::regclass AND conname = 'cars_owner_type_check'
  ) THEN
    ALTER TABLE public.cars
      ADD CONSTRAINT cars_owner_type_check
      CHECK (owner_type IN ('personal', 'third_party'));
  END IF;
END $$;


-- ============================================================================
-- 2) DEVISES SECONDAIRES DES VOITURES
-- ============================================================================
-- Le DZD reste la devise de référence : `price_per_day`, `price_week`,
-- `price_month` et `deposit` sont TOUJOURS en dinars. `currencies` porte
-- uniquement l'activation et le taux de chaque devise secondaire :
--   { "EUR": {"enabled": true, "rate": 150}, "USD": {...}, "GBP": {...} }
-- Les prix affichés dans ces devises sont dérivés à la volée du DZD.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS currencies jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ============================================================================
-- 3) SERVICE OBLIGATOIRE
-- ============================================================================
-- true : pré-sélectionné d'office sur toute nouvelle réservation (application
-- ET site public) et non décochable par le client.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;


-- ============================================================================
-- 4) RÉSERVATIONS — TIMBRE, DEVISE, CODE PROMO, ENTREPRISE, VOL
-- ============================================================================
ALTER TABLE public.reservations
  -- Timbre fiscal (droit de timbre) : 1 % / 1,5 % / 2 % par tranche de 100 DA
  ADD COLUMN IF NOT EXISTS timbre_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timbre_rate numeric,
  ADD COLUMN IF NOT EXISTS timbre_amount numeric NOT NULL DEFAULT 0,
  -- Devise choisie par le client sur le site public.
  -- `total_price` reste TOUJOURS exprimé en DZD (source de vérité comptable).
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'DZD',
  ADD COLUMN IF NOT EXISTS currency_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_price_currency numeric,
  -- Code promo consommé (NULL = aucun code : rien ne doit être affiché)
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS promo_discount_percentage numeric,
  ADD COLUMN IF NOT EXISTS promo_discount_amount numeric,
  -- Informations de vol saisies par le client sur le site
  ADD COLUMN IF NOT EXISTS flight_number text,
  ADD COLUMN IF NOT EXISTS flight_date date,
  ADD COLUMN IF NOT EXISTS flight_time time,
  ADD COLUMN IF NOT EXISTS flight_ticket_image text;


-- ============================================================================
-- 5) STATUT DE PAIEMENT (mis à jour à la clôture de la location)
-- ============================================================================
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reservations'::regclass
      AND conname = 'reservations_payment_status_check'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_payment_status_check
      CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;


-- ============================================================================
-- 6) ENTREPRISES (clients société : contrats + factures)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.entreprises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rc text,
  art text,
  nis text,
  nif text,
  address text,
  phone text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT entreprises_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS entreprises_name_idx ON public.entreprises (lower(name));

ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entreprises_auth_all" ON public.entreprises;
CREATE POLICY "entreprises_auth_all" ON public.entreprises
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Réservation rattachée à une entreprise (facturation société)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS entreprise_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reservations_entreprise_fkey'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_entreprise_fkey
      FOREIGN KEY (entreprise_id) REFERENCES public.entreprises(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reservations_entreprise_idx ON public.reservations (entreprise_id);


-- ============================================================================
-- 7) PARAMÈTRES DE LOCATION (globaux, appliqués à toutes les clôtures)
-- ============================================================================
-- Table singleton (id = 1) : limite de kilométrage incluse par jour, frais au
-- kilomètre dépassé, frais par cran de carburant manquant.
CREATE TABLE IF NOT EXISTS public.rental_settings (
  id integer NOT NULL DEFAULT 1,
  mileage_limit_per_day numeric NOT NULL DEFAULT 0,
  excess_mileage_fee_per_km numeric NOT NULL DEFAULT 0,
  fuel_fee_per_level numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rental_settings_pkey PRIMARY KEY (id),
  CONSTRAINT rental_settings_singleton CHECK (id = 1)
);

INSERT INTO public.rental_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rental_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rental_settings_auth_all" ON public.rental_settings;
CREATE POLICY "rental_settings_auth_all" ON public.rental_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- 8) RÔLES D'EMPLOYÉS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.worker_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worker_roles_pkey PRIMARY KEY (id),
  CONSTRAINT worker_roles_name_unique UNIQUE (name)
);

ALTER TABLE public.worker_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_roles_auth_all" ON public.worker_roles;
CREATE POLICY "worker_roles_auth_all" ON public.worker_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- 9) EMPLOYÉS — RÔLE, IDENTITÉ, PERMISSIONS, COMPTE DE CONNEXION
-- ============================================================================
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS id_card_number text,
  ADD COLUMN IF NOT EXISTS role_id uuid,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS payment_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  -- Permissions : { "interfaces": ["planner", ...],
  --                 "actions": { "planner": ["create", "delete"] } }
  -- Un nouvel employé démarre TOUJOURS sans aucune permission.
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{"interfaces": [], "actions": {}}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workers_role_fkey'
  ) THEN
    ALTER TABLE public.workers
      ADD CONSTRAINT workers_role_fkey
      FOREIGN KEY (role_id) REFERENCES public.worker_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Les employés existants qui ont déjà un email/mot de passe gardent leur accès.
UPDATE public.workers
SET account_enabled = true
WHERE account_enabled = false
  AND email IS NOT NULL AND email <> ''
  AND password IS NOT NULL AND password <> '';


-- ============================================================================
-- 10) ACOMPTES / ABSENCES — INDICATEUR « DÉJÀ DÉDUIT »
-- ============================================================================
ALTER TABLE public.worker_advances
  ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;

ALTER TABLE public.worker_absences
  ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;


-- ============================================================================
-- 11) PAIEMENTS D'EMPLOYÉS — PÉRIODE COUVERTE
-- ============================================================================
-- 'YYYY-MM' pour un salaire mensuel, 'YYYY-MM-DD' pour un salaire journalier.
-- Sert à ne plus proposer une période déjà payée.
ALTER TABLE public.worker_payments
  ADD COLUMN IF NOT EXISTS period_key text;

CREATE INDEX IF NOT EXISTS worker_payments_period_idx
  ON public.worker_payments (worker_id, period_key);


-- ============================================================================
-- 12) COMPTES DE CONNEXION DES EMPLOYÉS (auth.users)
-- ============================================================================
-- Crée / met à jour un utilisateur Supabase Auth depuis l'application, sans
-- clé de service et SANS déconnecter l'administrateur (contrairement à
-- auth.signUp). L'employé peut ensuite se connecter normalement avec
-- signInWithPassword depuis la page de connexion.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.upsert_worker_auth_user(
  p_email text,
  p_password text,
  p_full_name text DEFAULT '',
  p_role text DEFAULT 'worker'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Compte existant : on remet à jour le mot de passe et les métadonnées.
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                             || jsonb_build_object('full_name', p_full_name, 'role', p_role),
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('user_id', v_user_id, 'created', false);
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now(), now(), '', '', '', ''
  );

  -- Identité e-mail : nécessaire pour que signInWithPassword fonctionne.
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(), now(), now()
  );

  RETURN jsonb_build_object('user_id', v_user_id, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_worker_auth_user(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_worker_auth_user(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_worker_auth_user(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;

  DELETE FROM auth.identities WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_worker_auth_user(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_worker_auth_user(text) TO authenticated;


-- ============================================================================
-- 13) RPC SITE PUBLIC — DEVISE, CODE PROMO À USAGE UNIQUE, INFOS DE VOL
-- ============================================================================
-- Remplace la version du 2026-07-09 : mêmes garanties (transaction unique,
-- SECURITY DEFINER pour contourner la RLS du rôle anon, contrôle de
-- disponibilité) plus la devise choisie, le détail du code promo et le vol.
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
  v_promo record;
  v_service jsonb;
  v_car_id uuid := (p_reservation->>'car_id')::uuid;
  v_from date := (p_reservation->>'departure_date')::date;
  v_to date := (p_reservation->>'return_date')::date;
  v_promo_pct numeric := 0;
  v_promo_amount numeric := 0;
BEGIN
  -- Code promo : verrouillé puis consommé, garantissant UN SEUL usage même en
  -- cas de double soumission simultanée.
  IF p_promo_code IS NOT NULL AND btrim(p_promo_code) <> '' THEN
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE upper(code) = upper(btrim(p_promo_code))
      AND is_active = true
      AND is_used = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROMO_CODE_INVALID';
    END IF;
    v_promo_pct := v_promo.discount_percentage;
  END IF;

  -- Disponibilité de la voiture sur la période demandée
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.car_id = v_car_id
      AND r.status IN ('website_reservation', 'pending', 'accepted', 'confirmed', 'active')
      AND r.departure_date <= v_to
      AND r.return_date >= v_from
  ) THEN
    RAISE EXCEPTION 'CAR_UNAVAILABLE';
  END IF;

  -- Client
  INSERT INTO public.clients (
    first_name, last_name, phone, email, date_of_birth, place_of_birth,
    id_card_number, license_number, license_expiration_date, license_delivery_date,
    license_delivery_place, document_type, document_number, document_delivery_date,
    document_expiration_date, document_delivery_address, wilaya, complete_address,
    profile_photo, scanned_documents
  ) VALUES (
    p_client->>'first_name', p_client->>'last_name', p_client->>'phone', p_client->>'email',
    NULLIF(p_client->>'date_of_birth','')::date, p_client->>'place_of_birth',
    p_client->>'id_card_number', p_client->>'license_number',
    NULLIF(p_client->>'license_expiration_date','')::date,
    NULLIF(p_client->>'license_delivery_date','')::date,
    p_client->>'license_delivery_place', NULLIF(p_client->>'document_type',''),
    p_client->>'document_number', NULLIF(p_client->>'document_delivery_date','')::date,
    NULLIF(p_client->>'document_expiration_date','')::date,
    p_client->>'document_delivery_address', p_client->>'wilaya', p_client->>'complete_address',
    p_client->>'profile_photo',
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(p_client->'scanned_documents','[]'::jsonb)) AS value), ARRAY[]::text[])
  )
  RETURNING id INTO v_client_id;

  v_promo_amount := COALESCE(NULLIF(p_reservation->>'promo_discount_amount','')::numeric, 0);

  -- Réservation
  INSERT INTO public.reservations (
    client_id, car_id,
    departure_date, departure_time, departure_agency_id,
    return_date, return_time, return_agency_id,
    price_per_day, price_week, price_month,
    total_days, total_price, deposit,
    discount_amount, discount_type, notes,
    protection_assurance_id, protection_assurance_name, protection_assurance_price,
    currency, currency_rate, total_price_currency,
    promo_code, promo_discount_percentage, promo_discount_amount,
    flight_number, flight_date, flight_time, flight_ticket_image,
    status, source
  ) VALUES (
    v_client_id, v_car_id,
    v_from, NULLIF(p_reservation->>'departure_time','')::time, NULLIF(p_reservation->>'departure_agency_id','')::uuid,
    v_to, NULLIF(p_reservation->>'return_time','')::time, NULLIF(p_reservation->>'return_agency_id','')::uuid,
    COALESCE(NULLIF(p_reservation->>'price_per_day','')::numeric, 0),
    NULLIF(p_reservation->>'price_week','')::numeric,
    NULLIF(p_reservation->>'price_month','')::numeric,
    COALESCE(NULLIF(p_reservation->>'total_days','')::integer, 1),
    COALESCE(NULLIF(p_reservation->>'total_price','')::numeric, 0),
    COALESCE(NULLIF(p_reservation->>'deposit','')::numeric, 0),
    COALESCE(NULLIF(p_reservation->>'discount_amount','')::numeric, 0),
    NULLIF(p_reservation->>'discount_type',''),
    p_reservation->>'notes',
    NULLIF(p_reservation->>'protection_assurance_id','')::uuid,
    NULLIF(p_reservation->>'protection_assurance_name',''),
    COALESCE(NULLIF(p_reservation->>'protection_assurance_price','')::numeric, 0),
    COALESCE(NULLIF(p_reservation->>'currency',''), 'DZD'),
    COALESCE(NULLIF(p_reservation->>'currency_rate','')::numeric, 1),
    NULLIF(p_reservation->>'total_price_currency','')::numeric,
    NULLIF(p_reservation->>'promo_code',''),
    NULLIF(p_reservation->>'promo_discount_percentage','')::numeric,
    NULLIF(v_promo_amount, 0),
    NULLIF(p_reservation->>'flight_number',''),
    NULLIF(p_reservation->>'flight_date','')::date,
    NULLIF(p_reservation->>'flight_time','')::time,
    NULLIF(p_reservation->>'flight_ticket_image',''),
    'website_reservation', 'website'
  )
  RETURNING id INTO v_reservation_id;

  -- Services choisis (les services obligatoires sont déjà dans la liste)
  IF p_services IS NOT NULL AND jsonb_typeof(p_services) = 'array' THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(p_services) LOOP
      INSERT INTO public.reservation_services (reservation_id, category, service_name, description, price)
      VALUES (
        v_reservation_id,
        COALESCE(v_service->>'category', 'service'),
        COALESCE(v_service->>'service_name', ''),
        v_service->>'description',
        COALESCE(NULLIF(v_service->>'price','')::numeric, 0)
      );
    END LOOP;
  END IF;

  -- Consommation définitive du code promo : usage UNIQUE
  IF v_promo.id IS NOT NULL THEN
    UPDATE public.promo_codes
    SET is_used = true,
        used_at = now(),
        reservation_id = v_reservation_id,
        is_active = false
    WHERE id = v_promo.id;
  END IF;

  RETURN jsonb_build_object('reservation_id', v_reservation_id, 'client_id', v_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_website_reservation(jsonb, jsonb, jsonb, text) TO anon, authenticated;


-- ============================================================================
-- 14) VÉRIFICATION D'UN CODE PROMO — USAGE UNIQUE
-- ============================================================================
-- Un code déjà consommé (is_used) ou désactivé est refusé. Le code n'est PAS
-- consommé ici : seule la création effective de la réservation le consomme.
CREATE OR REPLACE FUNCTION public.verify_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v record;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty');
  END IF;

  SELECT * INTO v
  FROM public.promo_codes
  WHERE upper(code) = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF v.is_used THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
  END IF;
  IF NOT v.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  RETURN jsonb_build_object('valid', true, 'discount_percentage', v.discount_percentage);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_promo_code(text) TO anon, authenticated;


-- ============================================================================
-- 15) STOCKAGE DES PHOTOS D'INSPECTION
-- ============================================================================
-- Le bucket `inspection` doit autoriser la SUPPRESSION par un utilisateur
-- authentifié : les photos d'une réservation sont effacées définitivement à la
-- validation de « Terminer la location ».
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection', 'inspection', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "inspection_auth_all" ON storage.objects;
CREATE POLICY "inspection_auth_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'inspection')
  WITH CHECK (bucket_id = 'inspection');

DROP POLICY IF EXISTS "inspection_public_read" ON storage.objects;
CREATE POLICY "inspection_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'inspection');


-- ============================================================================
-- 16) LECTURES ANONYMES NÉCESSAIRES AU SITE PUBLIC
-- ============================================================================
-- Le site public doit lire les voitures (avec leurs devises) et les services
-- (dont le drapeau « obligatoire ») sans être connecté.
DROP POLICY IF EXISTS "cars_anon_select" ON public.cars;
CREATE POLICY "cars_anon_select" ON public.cars
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "services_anon_select" ON public.services;
CREATE POLICY "services_anon_select" ON public.services
  FOR SELECT TO anon USING (true);


-- ============================================================================
-- FIN — vérification rapide
-- ============================================================================
-- SELECT owner_type, currencies FROM public.cars LIMIT 5;
-- SELECT is_mandatory FROM public.services LIMIT 5;
-- SELECT timbre_enabled, currency, promo_code, entreprise_id FROM public.reservations LIMIT 5;
-- SELECT * FROM public.rental_settings;
-- SELECT id, name FROM public.entreprises LIMIT 5;
-- SELECT full_name, permissions, account_enabled FROM public.workers LIMIT 5;
