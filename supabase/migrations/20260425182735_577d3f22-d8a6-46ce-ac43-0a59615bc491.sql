-- Usuwamy kolumnę email z profiles, żeby nie była eksponowana wszystkim authenticated.
-- Email i tak jest dostępny w auth.users dla zalogowanego użytkownika (user.email).
-- Aktualizujemy też trigger handle_new_user, by nie próbował zapisywać emaila.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, avatar_url, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url',
    NULL
  );

  SELECT COUNT(*) INTO user_count FROM public.profiles;

  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;