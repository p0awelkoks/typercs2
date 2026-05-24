
-- Lista Discord ID adminów (zarządzana w DB; client trzyma kopię tylko poglądową)
CREATE TABLE IF NOT EXISTS public.admin_discord_ids (
  discord_id text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_discord_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage admin discord ids" ON public.admin_discord_ids;
CREATE POLICY "Admins manage admin discord ids"
  ON public.admin_discord_ids
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Nowy handle_new_user: Discord metadata -> profiles + auto-admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  discord_id text := COALESCE(meta->>'provider_id', meta->>'sub');
  base_username text;
  candidate text;
  suffix int := 0;
  user_count int;
  is_admin_by_discord boolean := false;
BEGIN
  base_username := COALESCE(
    NULLIF(meta->>'preferred_username',''),
    NULLIF(meta->>'user_name',''),
    NULLIF(meta->>'name',''),
    NULLIF(meta->>'full_name','')
  );
  -- normalizacja: tylko [a-zA-Z0-9_-], 3-24 znaki
  IF base_username IS NOT NULL THEN
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_-]', '', 'g');
    IF length(base_username) < 3 THEN base_username := NULL; END IF;
    IF base_username IS NOT NULL AND length(base_username) > 20 THEN
      base_username := substring(base_username from 1 for 20);
    END IF;
  END IF;

  candidate := base_username;
  IF candidate IS NOT NULL THEN
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
      suffix := suffix + 1;
      candidate := base_username || suffix::text;
      EXIT WHEN suffix > 9999;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, avatar_url, username, onboarded)
  VALUES (
    NEW.id,
    meta->>'avatar_url',
    candidate,
    candidate IS NOT NULL
  );

  -- Sprawdź czy Discord ID jest na liście adminów
  IF discord_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.admin_discord_ids WHERE admin_discord_ids.discord_id = discord_id)
      INTO is_admin_by_discord;
  END IF;

  SELECT COUNT(*) INTO user_count FROM public.profiles;

  IF is_admin_by_discord OR user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger (jeśli nie istnieje)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill istniejących profili: ustaw username z Discord metadata jeśli puste
DO $$
DECLARE
  u RECORD;
  meta jsonb;
  base text;
  cand text;
  s int;
BEGIN
  FOR u IN
    SELECT p.id, au.raw_user_meta_data
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE p.username IS NULL
  LOOP
    meta := COALESCE(u.raw_user_meta_data, '{}'::jsonb);
    base := COALESCE(
      NULLIF(meta->>'preferred_username',''),
      NULLIF(meta->>'user_name',''),
      NULLIF(meta->>'name',''),
      NULLIF(meta->>'full_name','')
    );
    IF base IS NULL THEN CONTINUE; END IF;
    base := regexp_replace(base, '[^a-zA-Z0-9_-]', '', 'g');
    IF length(base) < 3 THEN CONTINUE; END IF;
    IF length(base) > 20 THEN base := substring(base from 1 for 20); END IF;
    cand := base; s := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = cand) LOOP
      s := s + 1; cand := base || s::text;
      EXIT WHEN s > 9999;
    END LOOP;
    UPDATE public.profiles SET username = cand, onboarded = true,
      avatar_url = COALESCE(avatar_url, meta->>'avatar_url')
    WHERE id = u.id;
  END LOOP;
END $$;

-- Backfill ról admina po Discord ID (dla użytkowników już istniejących)
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::app_role
FROM auth.users au
JOIN public.admin_discord_ids a
  ON a.discord_id = COALESCE(au.raw_user_meta_data->>'provider_id', au.raw_user_meta_data->>'sub')
ON CONFLICT DO NOTHING;
