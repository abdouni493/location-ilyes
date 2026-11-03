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
