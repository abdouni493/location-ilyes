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
