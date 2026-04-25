-- Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true)
  ON CONFLICT (id) DO NOTHING;

-- avatars policies
CREATE POLICY "Avatars publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- team-logos policies
CREATE POLICY "Team logos publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

CREATE POLICY "Admins upload team logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'team-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update team logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'team-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete team logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'team-logos' AND public.has_role(auth.uid(), 'admin'));

-- Reset all points function
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
  UPDATE public.profiles SET points = 0;
  UPDATE public.bets SET points_awarded = 0;
  UPDATE public.bonus_answers SET points_awarded = 0;
END;
$$;

-- Reset single user points
CREATE OR REPLACE FUNCTION public.reset_user_points(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset points';
  END IF;
  UPDATE public.profiles SET points = 0 WHERE id = _user_id;
  UPDATE public.bets SET points_awarded = 0 WHERE user_id = _user_id;
  UPDATE public.bonus_answers SET points_awarded = 0 WHERE user_id = _user_id;
END;
$$;