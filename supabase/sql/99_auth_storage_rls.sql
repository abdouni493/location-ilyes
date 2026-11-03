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
