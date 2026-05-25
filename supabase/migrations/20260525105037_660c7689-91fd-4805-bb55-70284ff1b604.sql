DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  discord_id text := COALESCE(meta->>'provider_id', meta->>'sub');
  user_count int;
  is_admin_by_discord boolean := false;
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, onboarded)
  VALUES (NEW.id, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;

  IF discord_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.admin_discord_ids a
      WHERE a.discord_id = discord_id
    ) INTO is_admin_by_discord;
  END IF;

  SELECT COUNT(*) INTO user_count FROM public.profiles;

  IF is_admin_by_discord OR user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, username, avatar_url, onboarded)
SELECT u.id, NULL, NULL, false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;