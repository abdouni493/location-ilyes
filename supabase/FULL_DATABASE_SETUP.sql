-- ============================================================================
-- LOCATION ILYES — FULL DATABASE SETUP (new Supabase project)
-- ============================================================================
-- Paste this whole file in: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once (idempotent).
--
-- Contents:
--   PART 0  : base tables
--   PART 1+ : all dated migrations of supabase/migrations (in order)
--   LAST    : admin account from login page, worker accounts in auth.users,
--             session RPCs, RLS policies and storage buckets for images.
-- ============================================================================

-- ########## PART 0 : supabase/sql/00_base_schema.sql ##########
-- ============================================================================
-- 00 — BASE SCHEMA (tables de départ de l'application)
-- ============================================================================
-- Les migrations datées (supabase/migrations) ajoutent ensuite les colonnes,
-- tables et fonctions supplémentaires. Tout est idempotent (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---------------------------------------------------------------- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text,
  email      text,
  role       text NOT NULL DEFAULT 'admin',
  agency_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- agencies
CREATE TABLE IF NOT EXISTS public.agencies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text,
  city       text,
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- cars
CREATE TABLE IF NOT EXISTS public.cars (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         text,
  model         text,
  plate_number  text,
  year          integer,
  color         text,
  vin           text,
  energy        text,
  transmission  text,
  seats         integer DEFAULT 5,
  doors         integer DEFAULT 4,
  price_per_day numeric DEFAULT 0,
  price_week    numeric,
  price_month   numeric,
  deposit       numeric,
  mileage       numeric DEFAULT 0,
  image_url     text,
  status        text DEFAULT 'disponible',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- clients
CREATE TABLE IF NOT EXISTS public.clients (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name                text,
  last_name                 text,
  phone                     text,
  email                     text,
  date_of_birth             date,
  place_of_birth            text,
  id_card_number            text,
  license_number            text,
  license_expiration_date   date,
  license_delivery_date     date,
  license_delivery_place    text,
  document_type             text,
  document_number           text,
  document_delivery_date    date,
  document_expiration_date  date,
  document_delivery_address text,
  wilaya                    text,
  complete_address          text,
  profile_photo             text,
  scanned_documents         text[] DEFAULT ARRAY[]::text[],
  documents_urls            text[] DEFAULT ARRAY[]::text[],
  agency_id                 uuid,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- workers
CREATE TABLE IF NOT EXISTS public.workers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text,
  date_of_birth date,
  phone         text,
  email         text,
  address       text,
  profile_photo text,
  type          text DEFAULT 'worker',
  payment_type  text,
  base_salary   numeric DEFAULT 0,
  username      text,
  password      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_advances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  amount     numeric DEFAULT 0,
  date       date DEFAULT CURRENT_DATE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_absences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id  uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  cost       numeric DEFAULT 0,
  date       date DEFAULT CURRENT_DATE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  amount      numeric DEFAULT 0,
  date        date DEFAULT CURRENT_DATE,
  base_salary numeric DEFAULT 0,
  advances    numeric DEFAULT 0,
  absences    numeric DEFAULT 0,
  net_salary  numeric DEFAULT 0,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  car_id              uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  departure_date      date,
  departure_time      time,
  departure_agency_id uuid,
  return_date         date,
  return_time         time,
  return_agency_id    uuid,
  price_per_day       numeric DEFAULT 0,
  price_week          numeric,
  price_month         numeric,
  total_days          integer DEFAULT 1,
  total_price         numeric DEFAULT 0,
  deposit             numeric DEFAULT 0,
  discount_amount     numeric DEFAULT 0,
  discount_type       text,
  advance_payment     numeric DEFAULT 0,
  remaining_payment   numeric DEFAULT 0,
  additional_fees     numeric DEFAULT 0,
  status              text DEFAULT 'pending',
  notes               text,
  caution_amount_dzd  numeric,
  caution_currency    text DEFAULT 'DZD',
  caution_enabled     boolean DEFAULT true,
  is_manual_price     boolean DEFAULT false,
  euro_rate           numeric DEFAULT 145,
  assurance_enabled   boolean DEFAULT false,
  assurance_percentage numeric,
  timbre_enabled      boolean DEFAULT false,
  timbre_rate         numeric,
  timbre_amount       numeric DEFAULT 0,
  created_by          text,
  created_by_name     text,
  activated_at        timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_departure_agency_fkey') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_departure_agency_fkey
      FOREIGN KEY (departure_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_return_agency_fkey') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_return_agency_fkey
      FOREIGN KEY (return_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reservation_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  category       text,
  service_name   text,
  description    text,
  price          numeric DEFAULT 0,
  driver_id      uuid,
  driver_caution numeric DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  amount         numeric DEFAULT 0,
  payment_method text,
  date           date DEFAULT CURRENT_DATE,
  note           text,
  status         text DEFAULT 'completed',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- services
CREATE TABLE IF NOT EXISTS public.services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text,
  service_name text,
  description  text,
  price        numeric DEFAULT 0,
  is_active    boolean DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- special offers
CREATE TABLE IF NOT EXISTS public.special_offers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id     uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  old_price  numeric DEFAULT 0,
  new_price  numeric DEFAULT 0,
  note       text,
  is_active  boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- expenses
CREATE TABLE IF NOT EXISTS public.store_expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text,
  cost       numeric DEFAULT 0,
  date       date DEFAULT CURRENT_DATE,
  note       text,
  icon       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id              uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  type                text DEFAULT 'autre',
  cost                numeric DEFAULT 0,
  date                date DEFAULT CURRENT_DATE,
  note                text,
  current_mileage     numeric,
  next_vidange_km     numeric,
  expiration_date     date,
  expense_name        text,
  oil_filter_changed  boolean DEFAULT false,
  air_filter_changed  boolean DEFAULT false,
  fuel_filter_changed boolean DEFAULT false,
  ac_filter_changed   boolean DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_alerts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id               uuid REFERENCES public.cars(id) ON DELETE CASCADE,
  type                 text,
  car_info             text,
  message              text,
  due_date             date,
  is_expired           boolean DEFAULT false,
  days_until_due       integer,
  current_mileage      numeric,
  next_service_mileage numeric,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- inspections
CREATE TABLE IF NOT EXISTS public.inspection_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     text NOT NULL,
  category      text,
  display_order integer DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id       uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  type                 text NOT NULL DEFAULT 'departure',
  mileage              numeric,
  fuel_level           text,
  agency_id            uuid,
  date                 date,
  time                 time,
  notes                text,
  location             text,
  exterior_front_photo text,
  exterior_rear_photo  text,
  interior_photo       text,
  other_photos         text[] DEFAULT ARRAY[]::text[],
  client_signature     text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_inspections_reservation_type_key UNIQUE (reservation_id, type)
);

CREATE TABLE IF NOT EXISTS public.inspection_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id     uuid REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  checklist_item_id uuid REFERENCES public.inspection_checklist_items(id) ON DELETE CASCADE,
  status            boolean DEFAULT false,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inspection_responses_unique UNIQUE (inspection_id, checklist_item_id)
);

-- ---------------------------------------------------------------- documents
CREATE TABLE IF NOT EXISTS public.document_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      uuid,
  template_type  text,
  name           text,
  template       jsonb DEFAULT '{}'::jsonb,
  is_default     boolean DEFAULT false,
  has_conditions boolean DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agency_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name        text,
  logo               text,
  address            text,
  phone              text,
  document_templates jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- website
CREATE TABLE IF NOT EXISTS public.website_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text,
  description        text,
  logo               text,
  address            text,
  phone              text,
  phone_number_2     text,
  bank_number        text,
  landing_background text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.website_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook   text,
  instagram  text,
  tiktok     text,
  whatsapp   text,
  phone      text,
  address    text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- sessions (audit)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  access_token  text NOT NULL,
  refresh_token text,
  expires_at    bigint,
  user_agent    text,
  ip_address    text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_token_idx ON public.user_sessions (access_token);


-- ########## supabase/migrations/20260702_offers_visibility.sql ##########
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


-- ########## supabase/migrations/20260702_reserved_periods_rpc.sql ##########
-- Prompt 2 : calendrier public avec dates bloquées.
-- Fonction SECURITY DEFINER : permet aux visiteurs anonymes du site de connaître
-- les périodes déjà réservées d'une voiture SANS exposer aucune donnée client
-- (seules les dates sortent). À exécuter dans le SQL Editor de Supabase.

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
    AND r.status IN ('pending', 'confirmed', 'active');
$$;

GRANT EXECUTE ON FUNCTION public.get_reserved_periods(uuid) TO anon, authenticated;


-- ########## supabase/migrations/20260705_protection_assurances.sql ##########
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


-- ########## supabase/migrations/20260706_website_updates.sql ##########
-- ============================================================================
-- MISE À JOUR SITE WEB — 2026-07-06
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Changements ADDITIFS et idempotents (ré-exécutable).
--
-- Contenu :
--   1) website_settings.landing_background  → image de fond du landing
--   2) Table promo_codes + RLS              → codes promo gérés par l'admin
--   3) RPC verify_promo_code                → vérification anonyme d'un code
--   4) RPC create_website_reservation       → FIX RLS : création de réservation
--      depuis le site public (client + réservation + services + code promo)
--      en une seule transaction SECURITY DEFINER
--   5) RPC get_unavailable_car_ids          → voitures indisponibles sur une
--      période (recherche de disponibilité du landing)
--   6) RPC get_reserved_periods             → (re)création, calendrier public
--   7) Bucket storage "website"             → logo + image de fond du site
--      + policies d'upload anonyme sur le bucket "clients" (wizard public)
--   8) Policies SELECT anon sur les tables lues par le site public
-- ============================================================================


-- ============================================================================
-- 1) IMAGE DE FOND DU LANDING
-- ============================================================================
ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS landing_background TEXT;


-- ============================================================================
-- 2) CODES PROMO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_percentage numeric NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  is_active boolean NOT NULL DEFAULT true,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  reservation_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT promo_codes_code_unique UNIQUE (code),
  CONSTRAINT promo_codes_reservation_fkey
    FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE SET NULL
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- L'admin (authenticated) gère les codes ; les visiteurs anonymes ne lisent
-- JAMAIS la table directement (ils passent par les RPC ci-dessous).
DROP POLICY IF EXISTS "promo_codes_auth_all" ON public.promo_codes;
CREATE POLICY "promo_codes_auth_all" ON public.promo_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- 3) RPC : VÉRIFIER UN CODE PROMO (site public)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_row public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_row.is_used THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used');
  END IF;

  IF NOT v_row.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_percentage', v_row.discount_percentage
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_promo_code(text) TO anon, authenticated;


-- ============================================================================
-- 4) RPC : CRÉER UNE RÉSERVATION DEPUIS LE SITE PUBLIC  (FIX ERREURS RLS)
-- ============================================================================
-- Les tables clients / reservations / reservation_services n'acceptent que le
-- rôle authenticated : le site public (anon) recevait des erreurs RLS.
-- Cette fonction SECURITY DEFINER insère tout en une transaction, force le
-- statut 'pending', re-vérifie la disponibilité de la voiture et consomme le
-- code promo de façon atomique (impossible d'utiliser deux fois le même code).
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

  -- La voiture ne doit pas être déjà réservée sur la période demandée
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.car_id = v_car_id
      AND r.status IN ('pending', 'accepted', 'confirmed', 'active')
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

  -- 2) Réservation (statut TOUJOURS 'pending' : l'agence confirme ensuite)
  INSERT INTO public.reservations (
    client_id, car_id,
    departure_date, departure_time, departure_agency_id,
    return_date, return_time, return_agency_id,
    price_per_day, price_week, price_month,
    total_days, total_price, deposit,
    discount_amount, discount_type,
    advance_payment, remaining_payment,
    notes, status,
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
    'pending',
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
-- 5) RPC : VOITURES INDISPONIBLES SUR UNE PÉRIODE (recherche du landing)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_unavailable_car_ids(p_from date, p_to date)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT r.car_id
  FROM public.reservations r
  WHERE r.status IN ('pending', 'accepted', 'confirmed', 'active')
    AND r.departure_date <= p_to
    AND r.return_date >= p_from;
$$;

GRANT EXECUTE ON FUNCTION public.get_unavailable_car_ids(date, date) TO anon, authenticated;


-- ============================================================================
-- 6) RPC : PÉRIODES RÉSERVÉES D'UNE VOITURE (calendrier public) — idempotent
-- ============================================================================
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
    AND r.status IN ('pending', 'accepted', 'confirmed', 'active');
$$;

GRANT EXECUTE ON FUNCTION public.get_reserved_periods(uuid) TO anon, authenticated;


-- ============================================================================
-- 7) STORAGE : bucket "website" (logo + image de fond) + uploads anon "clients"
-- ============================================================================
-- Bucket public "website" : le logo et l'image de fond y sont stockés ensemble.
INSERT INTO storage.buckets (id, name, public)
VALUES ('website', 'website', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique du bucket website
DROP POLICY IF EXISTS "website_bucket_public_read" ON storage.objects;
CREATE POLICY "website_bucket_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'website');

-- Écriture par l'admin connecté sur le bucket website
DROP POLICY IF EXISTS "website_bucket_auth_insert" ON storage.objects;
CREATE POLICY "website_bucket_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'website');

DROP POLICY IF EXISTS "website_bucket_auth_update" ON storage.objects;
CREATE POLICY "website_bucket_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'website') WITH CHECK (bucket_id = 'website');

DROP POLICY IF EXISTS "website_bucket_auth_delete" ON storage.objects;
CREATE POLICY "website_bucket_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'website');

-- Le wizard public téléverse la photo de profil + documents scannés du client
-- dans le bucket "clients" : autorise l'INSERT anonyme (lecture déjà publique).
INSERT INTO storage.buckets (id, name, public)
VALUES ('clients', 'clients', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "clients_bucket_anon_insert" ON storage.objects;
CREATE POLICY "clients_bucket_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'clients');

DROP POLICY IF EXISTS "clients_bucket_public_read" ON storage.objects;
CREATE POLICY "clients_bucket_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'clients');


-- ============================================================================
-- 8) LECTURE ANONYME DES TABLES AFFICHÉES SUR LE SITE PUBLIC
-- ============================================================================
-- (idempotent : ne touche pas aux policies "authenticated" existantes)

DROP POLICY IF EXISTS "cars_select_public" ON public.cars;
CREATE POLICY "cars_select_public" ON public.cars
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "agencies_select_public" ON public.agencies;
CREATE POLICY "agencies_select_public" ON public.agencies
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "special_offers_select_public" ON public.special_offers;
CREATE POLICY "special_offers_select_public" ON public.special_offers
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "services_select_public" ON public.services;
CREATE POLICY "services_select_public" ON public.services
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "website_settings_select_public" ON public.website_settings;
CREATE POLICY "website_settings_select_public" ON public.website_settings
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "website_contacts_select_public" ON public.website_contacts;
CREATE POLICY "website_contacts_select_public" ON public.website_contacts
  FOR SELECT TO anon USING (true);

-- ============================================================================
-- Fin. Le site public peut créer des réservations, vérifier les codes promo,
-- chercher les voitures disponibles et afficher l'image de fond du landing.
-- ============================================================================


-- ########## supabase/migrations/20260708_reservation_source.sql ##########
-- ============================================================================
-- SOURCE DES RÉSERVATIONS (site web vs agence) — 2026-07-08
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Changements ADDITIFS et idempotents (ré-exécutable).
--
-- Objectif : distinguer les réservations créées par un client depuis le site
-- public de celles créées par l'agence (admin), afin que :
--   • une commande du site N'APPARAISSE PAS dans le planificateur tant que
--     l'agence ne l'a pas acceptée (statut 'pending') ni si elle est annulée ;
--   • le planificateur et les contrats puissent filtrer par origine.
--
--   'website' : réservation créée par un client depuis le site public
--   'agency'  : réservation créée par l'agence (admin) — valeur par défaut
-- ============================================================================


-- ============================================================================
-- 1) COLONNE source
-- ============================================================================
-- Défaut 'agency' : les réservations existantes créées par l'agence restent
-- visibles dans le planificateur (aucune régression).
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'agency';


-- ============================================================================
-- 2) BACKFILL des commandes déjà créées par le site public
-- ============================================================================
-- Les commandes du site passent par la RPC create_website_reservation qui ne
-- renseigne jamais created_by / created_by_name, et restent au statut
-- 'pending' (ou 'accepted') tant que l'agence ne les a pas confirmées.
-- On ne touche PAS aux réservations confirmées / actives / terminées : elles
-- restent 'agency' (donc visibles) — le défaut sûr.
UPDATE public.reservations
SET source = 'website'
WHERE source = 'agency'
  AND created_by IS NULL
  AND created_by_name IS NULL
  AND status IN ('pending', 'accepted');


-- ============================================================================
-- 3) RPC : CRÉER UNE RÉSERVATION DEPUIS LE SITE PUBLIC (marque source='website')
-- ============================================================================
-- Identique à la version du 2026-07-06, avec en plus source='website' pour que
-- la commande soit reconnue comme provenant du site (masquée du planificateur
-- jusqu'à acceptation par l'agence).
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

  -- La voiture ne doit pas être déjà réservée sur la période demandée
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.car_id = v_car_id
      AND r.status IN ('pending', 'accepted', 'confirmed', 'active')
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

  -- 2) Réservation (statut TOUJOURS 'pending', source TOUJOURS 'website')
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
    'pending',
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
-- Fin. Les commandes du site sont désormais marquées source='website' et
-- restent hors du planificateur tant que l'agence ne les a pas acceptées.
-- ============================================================================


-- ########## supabase/migrations/20260709_website_reservation_status.sql ##########
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


-- ########## supabase/migrations/20260725_mhd_auto_major_update.sql ##########
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


-- ########## supabase/migrations/20260727_reservation_soft_delete.sql ##########
-- ============================================================================
-- MHD AUTO — CORBEILLE DES RÉSERVATIONS (suppression réversible) — 2026-07-27
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase (le client anon ne peut pas
-- exécuter de DDL). Script ADDITIF et IDEMPOTENT : ré-exécutable sans risque,
-- aucune donnée existante n'est supprimée.
--
-- OBJECTIF
--   La suppression d'une réservation n'efface plus définitivement la ligne.
--   Elle renseigne désormais `deleted_at` (corbeille). Les réservations
--   supprimées sont masquées partout dans l'application, mais restent
--   consultables, restaurables ou supprimables DÉFINITIVEMENT depuis l'écran
--   Paramètres → Sauvegarde → Corbeille des réservations.
-- ============================================================================

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Accélère le filtrage « non supprimées » (lecture courante) et le listing de
-- la corbeille.
CREATE INDEX IF NOT EXISTS idx_reservations_deleted_at
  ON public.reservations (deleted_at);

-- Vérification rapide :
-- SELECT id, status, deleted_at FROM public.reservations
--   WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC;


-- ########## supabase/migrations/20260817_maintenance_custom_types.sql ##########
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


-- ########## supabase/migrations/20260824_multi_company.sql ##########
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


-- ########## supabase/migrations/20260902_reservations_par_agence.sql ##########
-- ============================================================================
-- MHD AUTO — CLOISONNEMENT DES RÉSERVATIONS PAR AGENCE — 2026-09-02
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase. Script ADDITIF et IDEMPOTENT :
-- rejouable sans risque, AUCUNE réservation n'est supprimée.
--
-- PROBLÈME TRAITÉ
--   Une réservation créée depuis une agence secondaire pouvait se retrouver
--   rattachée à une AUTRE agence (l'agence principale) ou à AUCUNE agence
--   (`company_id` NULL) :
--     * l'application devinait l'agence principale quand le périmètre de
--       l'utilisateur n'était pas (encore) résolu — corrigé côté application
--       dans `src/utils/companyContext.ts` (plus aucune agence n'est devinée) ;
--     * une ligne avec `company_id` NULL n'appartient à aucune agence : comme
--       chaque agence ne lit QUE ses propres lignes, la réservation devenait
--       invisible partout — « je l'ai créée mais je ne la retrouve pas ».
--
--   Ce script RÉPARE les réservations déjà enregistrées et affiche où chaque
--   réservation est rattachée (section 4) pour retrouver celles qui manquent.
--
-- RAPPEL : `companies` = agences MÉTIER (comptabilité + équipe propres).
--          `agencies`  = agences PHYSIQUES de départ/retour (inchangées).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) FILET DE SÉCURITÉ : trigger d'auto-remplissage de company_id
-- ============================================================================
-- Réaffirmé ici au cas où la migration 20260824 n'aurait pas été rejouée après
-- une restauration : à l'insertion, une réservation sans agence explicite est
-- rattachée à l'agence du compte connecté (`auth_company_id()`).
DO $$
BEGIN
  IF to_regclass('public.reservations') IS NOT NULL
     AND to_regproc('public.set_company_id_from_auth()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_set_company_id ON public.reservations;
    CREATE TRIGGER trg_set_company_id
      BEFORE INSERT ON public.reservations
      FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_auth();
  END IF;
END $$;


-- ============================================================================
-- 2) RÉPARATION : réservations orphelines (company_id IS NULL)
-- ============================================================================
-- Les commandes du site public NON ENCORE ACCEPTÉES (status
-- 'website_reservation') doivent RESTER sans agence : elles n'appartiennent à
-- personne tant que le super-admin ne les a pas attribuées. Elles sont donc
-- explicitement exclues de toutes les réparations ci-dessous.
DO $$
DECLARE
  n_par_client  int := 0;
  n_par_auteur  int := 0;
  n_restant     int := 0;
BEGIN
  IF to_regclass('public.reservations') IS NULL THEN
    RAISE NOTICE 'Table reservations absente — rien a faire.';
    RETURN;
  END IF;

  -- 2.a) L'agence du CLIENT de la réservation (cas le plus fiable : le client
  --      a été créé par la même agence, dans le même tunnel de réservation).
  UPDATE public.reservations r
  SET company_id = c.company_id
  FROM public.clients c
  WHERE r.company_id IS NULL
    AND r.client_id = c.id
    AND c.company_id IS NOT NULL
    AND COALESCE(r.status, '') <> 'website_reservation';
  GET DIAGNOSTICS n_par_client = ROW_COUNT;

  -- 2.b) Sinon, l'agence de l'EMPLOYÉ qui a saisi la réservation.
  IF to_regclass('public.workers') IS NOT NULL THEN
    UPDATE public.reservations r
    SET company_id = w.company_id
    FROM public.workers w
    WHERE r.company_id IS NULL
      AND w.company_id IS NOT NULL
      AND COALESCE(r.status, '') <> 'website_reservation'
      AND (
        (r.created_by IS NOT NULL AND r.created_by::text = w.id::text)
        OR (
          r.created_by_name IS NOT NULL
          AND w.full_name IS NOT NULL
          AND lower(trim(r.created_by_name)) = lower(trim(w.full_name))
        )
      );
    GET DIAGNOSTICS n_par_auteur = ROW_COUNT;
  END IF;

  SELECT count(*) INTO n_restant
  FROM public.reservations
  WHERE company_id IS NULL
    AND COALESCE(status, '') <> 'website_reservation';

  RAISE NOTICE 'Reservations rattachees via leur client  : %', n_par_client;
  RAISE NOTICE 'Reservations rattachees via leur auteur  : %', n_par_auteur;
  RAISE NOTICE 'Reservations encore SANS agence          : %  (voir section 4)', n_restant;
END $$;


-- ============================================================================
-- 3) RÉPARATION : clients orphelins (company_id IS NULL)
-- ============================================================================
-- Un client sans agence n'apparaît dans la liste d'AUCUNE agence. On le
-- rattache à l'agence de ses réservations (la plus récente fait foi).
DO $$
DECLARE
  n int := 0;
BEGIN
  IF to_regclass('public.clients') IS NULL THEN RETURN; END IF;

  UPDATE public.clients c
  SET company_id = sub.company_id
  FROM (
    SELECT DISTINCT ON (r.client_id) r.client_id, r.company_id
    FROM public.reservations r
    WHERE r.company_id IS NOT NULL AND r.client_id IS NOT NULL
    ORDER BY r.client_id, r.created_at DESC
  ) sub
  WHERE c.company_id IS NULL AND c.id = sub.client_id;
  GET DIAGNOSTICS n = ROW_COUNT;

  RAISE NOTICE 'Clients rattaches via leurs reservations : %', n;
END $$;


-- ============================================================================
-- 4) CONTRÔLE : où est rattachée chaque réservation ?
-- ============================================================================
-- Ce bloc ne modifie RIEN : il écrit dans l'onglet « Messages » du SQL Editor
-- les 20 dernières réservations avec leur agence, pour retrouver une
-- réservation « introuvable ».
DO $$
DECLARE
  rec record;
BEGIN
  RAISE NOTICE '--- 20 dernieres reservations (jour | agence | statut | origine | client | auteur) ---';
  FOR rec IN
    SELECT r.created_at::date AS jour,
           COALESCE(co.name, '(AUCUNE AGENCE)') AS agence,
           r.status,
           COALESCE(r.source, 'agency') AS origine,
           COALESCE(cl.first_name || ' ' || cl.last_name, '(client inconnu)') AS client,
           COALESCE(r.created_by_name, '-') AS auteur
    FROM public.reservations r
    LEFT JOIN public.companies co ON co.id = r.company_id
    LEFT JOIN public.clients   cl ON cl.id = r.client_id
    ORDER BY r.created_at DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '% | % | % | % | % | %',
      rec.jour, rec.agence, rec.status, rec.origine, rec.client, rec.auteur;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- AIDE-MÉMOIRE (à exécuter à la main dans le SQL Editor si besoin)
-- ============================================================================
-- 1) Combien de réservations par agence ?
--
--    SELECT COALESCE(c.name, '(aucune agence)') AS agence, count(*)
--    FROM public.reservations r
--    LEFT JOIN public.companies c ON c.id = r.company_id
--    GROUP BY 1 ORDER BY 2 DESC;
--
-- 2) Retrouver une réservation précise (par nom de client) et son agence :
--
--    SELECT r.id, r.created_at, r.status, c.name AS agence,
--           cl.first_name, cl.last_name
--    FROM public.reservations r
--    LEFT JOIN public.companies c ON c.id = r.company_id
--    LEFT JOIN public.clients  cl ON cl.id = r.client_id
--    WHERE cl.last_name ILIKE '%NOM_DU_CLIENT%'
--    ORDER BY r.created_at DESC;
--
-- 3) Déplacer une réservation (ET son client) vers la bonne agence :
--
--    UPDATE public.reservations SET company_id =
--      (SELECT id FROM public.companies WHERE name = 'NOM DE L AGENCE')
--    WHERE id = 'ID_DE_LA_RESERVATION';
--
--    UPDATE public.clients SET company_id =
--      (SELECT id FROM public.companies WHERE name = 'NOM DE L AGENCE')
--    WHERE id = (SELECT client_id FROM public.reservations
--                WHERE id = 'ID_DE_LA_RESERVATION');
--
-- 4) Vérifier le rattachement des comptes de connexion (qui voit quoi) :
--
--    SELECT u.email, c.name AS agence, a.is_super_admin
--    FROM public.app_users a
--    JOIN auth.users u ON u.id = a.user_id
--    LEFT JOIN public.companies c ON c.id = a.company_id
--    ORDER BY a.is_super_admin DESC, c.name;
--
--    Un admin d'agence SANS ligne dans app_users (ou avec company_id NULL) n'a
--    aucun périmètre : il voit tout et ses créations ne sont rattachées à
--    aucune agence. Corriger avec :
--
--    INSERT INTO public.app_users (user_id, company_id, is_super_admin)
--    SELECT u.id, (SELECT id FROM public.companies WHERE name = 'NOM AGENCE'), false
--    FROM auth.users u WHERE lower(u.email) = lower('admin@agence.com')
--    ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;
-- ============================================================================


-- ########## supabase/migrations/20260918_continuite_location.sql ##########
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


-- ########## supabase/migrations/20260922_update_own_credentials.sql ##########
-- ============================================================================
-- MISE À JOUR DE SES PROPRES IDENTIFIANTS (Paramètres ▸ Profil & sécurité)
-- ============================================================================
-- Jusqu'ici, l'écran « Informations de connexion » n'enregistrait rien : le
-- formulaire n'avait aucun gestionnaire de soumission. Même branché,
-- `supabase.auth.updateUser()` ne suffisait pas :
--   • les EMPLOYÉS se connectent via la RPC `login_worker` (session « worker »,
--     rôle anon côté PostgREST) : ils n'ont aucune session Auth à mettre à jour ;
--   • pour les ADMINS, un changement d'e-mail reste EN ATTENTE tant que le lien
--     de confirmation n'est pas ouvert — d'où l'impression que « rien ne change ».
--
-- Cette RPC applique le changement des deux côtés (auth.users + public.workers)
-- en une seule transaction, après vérification du MOT DE PASSE ACTUEL. C'est
-- cette vérification qui permet de l'exposer au rôle anon sans créer de faille :
-- sans le mot de passe courant, aucun compte ne peut être modifié. Elle ne
-- touche QUE le compte dont le mot de passe courant a été prouvé.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_own_credentials(
  p_current_email    text,
  p_current_password text,
  p_new_email        text DEFAULT NULL,
  p_new_username     text DEFAULT NULL,
  p_new_password     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_cur_email  text := lower(trim(p_current_email));
  v_new_email  text := NULLIF(lower(trim(COALESCE(p_new_email, ''))), '');
  v_username   text := NULLIF(trim(COALESCE(p_new_username, '')), '');
  v_user_id    uuid;
  v_auth_ok    boolean := false;
  v_worker_ok  boolean := false;
  v_worker_id  uuid;
BEGIN
  IF v_cur_email IS NULL OR v_cur_email = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;
  IF p_current_password IS NULL OR p_current_password = '' THEN
    RAISE EXCEPTION 'CURRENT_PASSWORD_REQUIRED';
  END IF;
  IF p_new_password IS NOT NULL AND p_new_password <> '' AND length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT';
  END IF;

  -- L'e-mail inchangé est traité comme « pas de changement d'e-mail ».
  IF v_new_email = v_cur_email THEN
    v_new_email := NULL;
  END IF;

  -- 1) Identité : compte Supabase Auth (admins, et employés dotés d'un compte).
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_cur_email LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    SELECT (encrypted_password = extensions.crypt(p_current_password, encrypted_password))
      INTO v_auth_ok
    FROM auth.users WHERE id = v_user_id;
    v_auth_ok := COALESCE(v_auth_ok, false);
  END IF;

  -- 2) Repli : employé sans compte Auth, authentifié sur `workers.password`.
  SELECT id INTO v_worker_id FROM public.workers WHERE lower(email) = v_cur_email LIMIT 1;
  IF v_worker_id IS NOT NULL THEN
    SELECT (password IS NOT NULL AND password = p_current_password)
      INTO v_worker_ok
    FROM public.workers WHERE id = v_worker_id;
    v_worker_ok := COALESCE(v_worker_ok, false);
  END IF;

  IF NOT v_auth_ok AND NOT v_worker_ok THEN
    RAISE EXCEPTION 'INVALID_CURRENT_PASSWORD';
  END IF;

  -- 3) Le nouvel e-mail ne doit appartenir à personne d'autre.
  IF v_new_email IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_new_email AND id IS DISTINCT FROM v_user_id) THEN
      RAISE EXCEPTION 'EMAIL_ALREADY_USED';
    END IF;
    IF EXISTS (SELECT 1 FROM public.workers WHERE lower(email) = v_new_email AND id IS DISTINCT FROM v_worker_id) THEN
      RAISE EXCEPTION 'EMAIL_ALREADY_USED';
    END IF;
  END IF;

  -- 4) Nom d'utilisateur : unique parmi les employés.
  IF v_username IS NOT NULL AND v_worker_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.workers
      WHERE lower(username) = lower(v_username) AND id IS DISTINCT FROM v_worker_id
    ) THEN
      RAISE EXCEPTION 'USERNAME_ALREADY_USED';
    END IF;
  END IF;

  -- 5) Application sur auth.users (+ identité e-mail, sinon la connexion casse).
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET email              = COALESCE(v_new_email, email),
        encrypted_password = CASE
                               WHEN p_new_password IS NULL OR p_new_password = '' THEN encrypted_password
                               ELSE extensions.crypt(p_new_password, extensions.gen_salt('bf'))
                             END,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at         = now()
    WHERE id = v_user_id;

    IF v_new_email IS NOT NULL THEN
      UPDATE auth.identities
      SET identity_data = COALESCE(identity_data, '{}'::jsonb)
                          || jsonb_build_object('email', v_new_email, 'email_verified', true),
          updated_at    = now()
      WHERE user_id = v_user_id AND provider = 'email';
    END IF;
  END IF;

  -- 6) Application sur la fiche employé (e-mail, identifiant, mot de passe).
  IF v_worker_id IS NOT NULL THEN
    UPDATE public.workers
    SET email    = COALESCE(v_new_email, email),
        username = COALESCE(v_username, username),
        password = CASE
                     WHEN p_new_password IS NULL OR p_new_password = '' THEN password
                     ELSE p_new_password
                   END
    WHERE id = v_worker_id;
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'email',            COALESCE(v_new_email, v_cur_email),
    'email_changed',    v_new_email IS NOT NULL,
    'password_changed', p_new_password IS NOT NULL AND p_new_password <> '',
    'auth_user',        v_user_id IS NOT NULL,
    'worker',           v_worker_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_credentials(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_own_credentials(text, text, text, text, text) TO anon, authenticated;


-- ============================================================================
-- MISE À JOUR DE SON PROPRE PROFIL (nom complet)
-- ============================================================================
-- Même raison : un employé (rôle anon) ne peut pas écrire dans `workers` via la
-- RLS. On expose donc une écriture volontairement étroite — le nom complet et
-- rien d'autre — limitée à la ligne portant l'e-mail fourni.
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_email     text,
  p_full_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_name  text := NULLIF(trim(COALESCE(p_full_name, '')), '');
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'NAME_REQUIRED';
  END IF;

  UPDATE public.workers SET full_name = v_name WHERE lower(email) = v_email;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                           || jsonb_build_object('full_name', v_name),
      updated_at = now()
  WHERE lower(email) = v_email;

  RETURN jsonb_build_object('success', true, 'full_name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_profile(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text) TO anon, authenticated;


-- ########## supabase/migrations/20261102_reservation_fixes_worker_commissions.sql ##########
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

-- ########## LAST : supabase/sql/99_auth_storage_rls.sql ##########
-- ============================================================================
-- 99 — AUTH (admin + employés), SESSIONS, STOCKAGE (buckets) ET RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Compte ADMINISTRATEUR créé depuis la page de connexion
-- ----------------------------------------------------------------------------
-- Le premier compte créé via supabase.auth.signUp() (bouton « Créer le compte
-- administrateur ») devient l'administrateur principal :
--   • e-mail confirmé automatiquement (connexion immédiate, sans lien e-mail) ;
--   • ligne public.profiles (role = 'admin') ;
--   • ligne public.app_users (super-admin rattaché à l'agence principale).
-- Les comptes EMPLOYÉS (créés par upsert_worker_auth_user) gardent leur rôle.

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

CREATE OR REPLACE VIEW public.admin_count AS
  SELECT count(*)::int AS count FROM public.profiles WHERE role = 'admin';
GRANT SELECT ON public.admin_count TO anon, authenticated;

-- BEFORE INSERT : confirme l'e-mail du tout premier administrateur.
CREATE OR REPLACE FUNCTION public.auto_confirm_first_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'admin') = 'admin'
     AND NOT public.admin_exists() THEN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
CREATE TRIGGER on_auth_user_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_first_admin();

-- AFTER INSERT : profil + rattachement agence.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_meta_role text := NEW.raw_user_meta_data->>'role';
  v_first     boolean := NOT public.admin_exists();
  v_role      text;
  v_company   uuid;
BEGIN
  -- Premier compte = administrateur principal. Tous les comptes suivants sont
  -- créés par l'admin pour ses employés (rôle = type de l'employé).
  IF v_first THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(v_meta_role, 'worker');
  END IF;

  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF v_first THEN
    SELECT id INTO v_company FROM public.companies WHERE is_primary ORDER BY created_at LIMIT 1;
    IF v_company IS NULL THEN
      INSERT INTO public.companies (name, is_primary) VALUES ('Agence principale', true)
      RETURNING id INTO v_company;
    END IF;
    INSERT INTO public.app_users (user_id, company_id, is_super_admin)
    VALUES (NEW.id, v_company, true)
    ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true;
  ELSE
    -- L'employé est rattaché à l'agence de sa fiche (ou à l'agence principale).
    SELECT COALESCE(
             (SELECT w.company_id FROM public.workers w WHERE lower(w.email) = lower(NEW.email) LIMIT 1),
             (SELECT id FROM public.companies WHERE is_primary ORDER BY created_at LIMIT 1))
      INTO v_company;
    INSERT INTO public.app_users (user_id, company_id, is_super_admin)
    VALUES (NEW.id, v_company, false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Le client tente aussi un upsert de son profil juste après signUp.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_upsert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_upsert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.auth_is_super_admin()) WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- 2) Comptes EMPLOYÉS dans auth.users
-- ----------------------------------------------------------------------------
-- upsert_worker_auth_user / delete_worker_auth_user (migration 20260725) sont
-- appelées par l'admin depuis « Équipe ». En plus, ce trigger synchronise
-- automatiquement : dès qu'une fiche employé possède e-mail + mot de passe et
-- account_enabled = true, son compte Supabase Auth est créé / mis à jour.
CREATE OR REPLACE FUNCTION public.sync_worker_auth_account()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF COALESCE(NEW.account_enabled, false)
     AND NEW.email IS NOT NULL AND btrim(NEW.email) <> ''
     AND NEW.password IS NOT NULL AND length(NEW.password) >= 6
     AND (TG_OP = 'INSERT'
          OR NEW.email IS DISTINCT FROM OLD.email
          OR NEW.password IS DISTINCT FROM OLD.password
          OR NEW.account_enabled IS DISTINCT FROM OLD.account_enabled
          OR NEW.type IS DISTINCT FROM OLD.type
          OR NEW.auth_user_id IS NULL) THEN
    v_res := public.upsert_worker_auth_user(NEW.email, NEW.password, COALESCE(NEW.full_name, ''), COALESCE(NEW.type, 'worker'));
    NEW.auth_user_id := (v_res->>'user_id')::uuid;
    NEW.email := lower(btrim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_worker_auth_account ON public.workers;
CREATE TRIGGER trg_sync_worker_auth_account
  BEFORE INSERT OR UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.sync_worker_auth_account();

-- Connexion de secours d'un employé (e-mail OU nom d'utilisateur + mot de passe).
-- Si l'identifiant est valide, le compte Auth est (re)créé avec ce mot de passe,
-- puis l'application se reconnecte avec signInWithPassword.
CREATE OR REPLACE FUNCTION public.login_worker(p_email_or_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  w public.workers%ROWTYPE;
  v_login text := lower(btrim(COALESCE(p_email_or_username, '')));
BEGIN
  SELECT * INTO w FROM public.workers
  WHERE (lower(email) = v_login OR lower(username) = v_login)
  LIMIT 1;

  IF NOT FOUND OR w.password IS NULL OR w.password <> p_password THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
  END IF;
  IF w.account_enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_DISABLED');
  END IF;

  IF w.email IS NOT NULL AND btrim(w.email) <> '' AND length(p_password) >= 6 THEN
    PERFORM public.upsert_worker_auth_user(w.email, p_password, COALESCE(w.full_name, ''), COALESCE(w.type, 'worker'));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'worker', jsonb_build_object(
      'id', w.id, 'full_name', w.full_name, 'email', lower(w.email),
      'type', COALESCE(w.type, 'worker'), 'profile_photo', w.profile_photo,
      'permissions', w.permissions, 'company_id', w.company_id
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.login_worker(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.login_worker(text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3) Sessions (journal facultatif utilisé par sessionService)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_admin_session(
  p_access_token text, p_refresh_token text, p_expires_at bigint,
  p_user_agent text DEFAULT NULL, p_ip_address text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  INSERT INTO public.user_sessions (user_id, access_token, refresh_token, expires_at, user_agent, ip_address)
  VALUES (auth.uid(), p_access_token, p_refresh_token, p_expires_at, p_user_agent, p_ip_address)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_session(p_token text)
RETURNS TABLE (user_id uuid, expires_at bigint, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, s.expires_at, s.is_active
  FROM public.user_sessions s
  WHERE s.access_token = p_token AND s.is_active
  ORDER BY s.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_session(p_token text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_sessions SET is_active = false WHERE access_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.create_admin_session(text, text, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_session(text) TO anon, authenticated;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 4) RLS : accès complet pour les utilisateurs connectés (admin + employés),
--    lecture publique (anon) pour ce que le site vitrine affiche.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'agencies','cars','clients','workers','worker_advances','worker_absences',
    'worker_payments','worker_roles','reservations','reservation_services','payments',
    'services','special_offers','store_expenses','vehicle_expenses','maintenance_alerts',
    'maintenance_types','inspection_checklist_items','vehicle_inspections',
    'inspection_responses','document_templates','agency_settings','website_settings',
    'website_contacts','protection_assurances','protection_assurance_items',
    'protection_assurance_item_links','promo_codes','entreprises','rental_settings',
    'reservation_continuations','reservation_worker_commissions'
  ];
  public_read text[] := ARRAY[
    'agencies','cars','services','special_offers','website_settings','website_contacts',
    'protection_assurances','protection_assurance_items','protection_assurance_item_links',
    'rental_settings','maintenance_types','companies'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS app_authenticated_all ON public.%I', t);
      EXECUTE format('CREATE POLICY app_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY public_read LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS app_public_read ON public.%I', t);
      EXECUTE format('CREATE POLICY app_public_read ON public.%I FOR SELECT TO anon USING (true)', t);
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;


-- ----------------------------------------------------------------------------
-- 5) STOCKAGE : buckets pour les images
-- ----------------------------------------------------------------------------
--   cars       → photos des véhicules
--   clients    → photos de profil + documents scannés des clients
--   inspection → photos d'état des lieux + signatures
--   website    → logo, fond d'accueil, visuels du site
--   workers / worker → photos de profil des employés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cars',       'cars',       true, 10485760, NULL),
  ('clients',    'clients',    true, 10485760, NULL),
  ('inspection', 'inspection', true, 10485760, NULL),
  ('website',    'website',    true, 10485760, NULL),
  ('workers',    'workers',    true, 10485760, NULL),
  ('worker',     'worker',     true, 10485760, NULL)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS app_images_public_read ON storage.objects;
DROP POLICY IF EXISTS app_images_auth_insert ON storage.objects;
DROP POLICY IF EXISTS app_images_auth_update ON storage.objects;
DROP POLICY IF EXISTS app_images_auth_delete ON storage.objects;
DROP POLICY IF EXISTS app_images_anon_insert ON storage.objects;

CREATE POLICY app_images_public_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('cars','clients','inspection','website','workers','worker'));
CREATE POLICY app_images_auth_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('cars','clients','inspection','website','workers','worker'));
CREATE POLICY app_images_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('cars','clients','inspection','website','workers','worker'))
  WITH CHECK (bucket_id IN ('cars','clients','inspection','website','workers','worker'));
CREATE POLICY app_images_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('cars','clients','inspection','website','workers','worker'));
-- Le site public envoie les documents du client (permis, billet d'avion).
CREATE POLICY app_images_anon_insert ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id IN ('clients'));

NOTIFY pgrst, 'reload schema';
