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
