
-- Upewnij się że trigger istnieje na auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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
  avatar text;
BEGIN
  -- Discord metadata keys: user_name, preferred_username, full_name, name, custom_claims.global_name
  base_username := COALESCE(
    NULLIF(meta->>'user_name',''),
    NULLIF(meta->>'preferred_username',''),
    NULLIF(meta->>'nickname',''),
    NULLIF(meta->>'full_name',''),
    NULLIF(meta->>'name',''),
    NULLIF(meta->'custom_claims'->>'global_name','')
  );

  IF base_username IS NOT NULL THEN
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_-]', '', 'g');
    IF length(base_username) < 3 THEN base_username := NULL; END IF;
    IF base_username IS NOT NULL AND length(base_username) > 20 THEN
      base_username := substring(base_username from 1 for 20);
    END IF;
  END IF;

  -- Fallback: user_xxxxxx jeśli nadal brak
  IF base_username IS NULL THEN
    base_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
    EXIT WHEN suffix > 9999;
  END LOOP;

  avatar := COALESCE(meta->>'avatar_url', meta->>'picture');

  INSERT INTO public.profiles (id, avatar_url, username, onboarded)
  VALUES (NEW.id, avatar, candidate, true)
  ON CONFLICT (id) DO UPDATE
    SET username = COALESCE(public.profiles.username, EXCLUDED.username),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        onboarded = true;

  IF discord_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.admin_discord_ids a WHERE a.discord_id = discord_id)
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
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill brakujących profili dla istniejących Discord userów
INSERT INTO public.profiles (id, username, avatar_url, onboarded)
SELECT
  u.id,
  'user_' || substr(replace(u.id::text, '-', ''), 1, 8),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Uzupełnij username dla profili które mają NULL
UPDATE public.profiles p
SET username = sub.new_username,
    avatar_url = COALESCE(p.avatar_url, sub.new_avatar),
    onboarded = true
FROM (
  SELECT
    u.id,
    COALESCE(
      NULLIF(regexp_replace(COALESCE(
        u.raw_user_meta_data->>'user_name',
        u.raw_user_meta_data->>'preferred_username',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
      ), '[^a-zA-Z0-9_-]', '', 'g'), ''),
      'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
    ) AS new_username,
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') AS new_avatar
  FROM auth.users u
) sub
WHERE p.id = sub.id AND (p.username IS NULL OR p.username = '');
