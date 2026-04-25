CREATE OR REPLACE FUNCTION public.reset_all_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset points';
  END IF;
  UPDATE public.profiles SET points = 0 WHERE id IS NOT NULL;
  UPDATE public.bets SET points_awarded = 0 WHERE id IS NOT NULL;
  UPDATE public.bonus_answers SET points_awarded = 0 WHERE id IS NOT NULL;
END;
$$;