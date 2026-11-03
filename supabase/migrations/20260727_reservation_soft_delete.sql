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
