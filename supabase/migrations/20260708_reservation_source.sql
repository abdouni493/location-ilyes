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
