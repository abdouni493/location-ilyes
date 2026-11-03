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
