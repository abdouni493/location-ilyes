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
