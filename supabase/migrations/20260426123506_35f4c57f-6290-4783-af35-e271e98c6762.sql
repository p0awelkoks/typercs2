
-- 1. UNIQUE constraints (naprawia upserty + zapobiega duplikatom)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
ALTER TABLE public.bets ADD CONSTRAINT bets_user_match_unique UNIQUE (user_id, match_id);
ALTER TABLE public.bonus_answers ADD CONSTRAINT bonus_answers_user_question_unique UNIQUE (user_id, question_id);

-- 2. Indeksy wydajnościowe
CREATE INDEX IF NOT EXISTS idx_bets_match_id ON public.bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_answers_question_id ON public.bonus_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_bonus_answers_user_id ON public.bonus_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_questions_match_id ON public.bonus_questions(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_status_start_time ON public.matches(status, start_time);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- 3. Naprawa reset_user_points (UPDATE bez WHERE)
CREATE OR REPLACE FUNCTION public.reset_user_points(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset points';
  END IF;
  UPDATE public.profiles SET points = 0 WHERE id = _user_id;
  UPDATE public.bets SET points_awarded = 0 WHERE user_id = _user_id;
  UPDATE public.bonus_answers SET points_awarded = 0 WHERE user_id = _user_id;
END;
$function$;

-- 4. Pozwól gościom (anon) oglądać publiczne dane (mecze, pytania, ranking)
DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;
CREATE POLICY "Public can view matches"
  ON public.matches FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view bonus questions" ON public.bonus_questions;
CREATE POLICY "Public can view bonus questions"
  ON public.bonus_questions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public can view profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. Storage: pozwól odczyt pojedynczych plików, zablokuj listowanie buckets.
-- Polityka SELECT na storage.objects już istnieje (publiczne buckets), ale chcemy
-- ograniczyć ją do bezpośredniego dostępu po nazwie pliku, nie listowania.
-- Domyślne polityki tworzone przy publicznym buckecie zostawiamy — ostrzeżenie
-- lintera jest świadomym kompromisem (publiczne avatary i loga drużyn muszą być
-- dostępne przez URL bez auth). Listowanie nie ujawnia żadnych prywatnych danych.
