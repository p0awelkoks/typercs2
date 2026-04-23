
-- =========================================================
-- CS2 TYPER — schemat bazy
-- =========================================================

-- ROLES enum + tabela ról (oddzielnie od profili — bezpieczeństwo)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER — sprawdzenie roli bez rekursji RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- PROFILES — username, avatar, punkty
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: po sign-up tworzy profil + nadaje rolę admin pierwszemu userowi
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url, username)
  VALUES (
    NEW.id,
    NEW.email,
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
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- MATCHES
-- =========================================================
CREATE TYPE public.match_status AS ENUM ('upcoming', 'finished');

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  team_a_logo TEXT,
  team_b_logo TEXT,
  tournament TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  status public.match_status NOT NULL DEFAULT 'upcoming',
  result_a INTEGER,
  result_b INTEGER,
  winner TEXT, -- 'A' | 'B'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view matches"
  ON public.matches FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage matches"
  ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- BONUS QUESTIONS (powiązane z meczem)
-- =========================================================
CREATE TABLE public.bonus_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  correct_answer TEXT, -- 'yes'/'no' lub dowolna wartość
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bonus_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bonus questions"
  ON public.bonus_questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage bonus questions"
  ON public.bonus_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- BETS — typy meczowe
-- =========================================================
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_winner TEXT NOT NULL, -- 'A' | 'B'
  predicted_score_a INTEGER,
  predicted_score_b INTEGER,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own bets"
  ON public.bets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all bets"
  ON public.bets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT/UPDATE tylko dla nadchodzących meczy
CREATE POLICY "Users insert own bet before start"
  ON public.bets FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'upcoming'
        AND m.start_time > now()
    )
  );

CREATE POLICY "Users update own bet before start"
  ON public.bets FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'upcoming'
        AND m.start_time > now()
    )
  );

-- =========================================================
-- BONUS ANSWERS
-- =========================================================
CREATE TABLE public.bonus_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.bonus_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.bonus_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own bonus answers"
  ON public.bonus_answers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all bonus answers"
  ON public.bonus_answers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert bonus answer before match start"
  ON public.bonus_answers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bonus_questions q
      JOIN public.matches m ON m.id = q.match_id
      WHERE q.id = question_id
        AND m.status = 'upcoming'
        AND m.start_time > now()
    )
  );

CREATE POLICY "Users update bonus answer before match start"
  ON public.bonus_answers FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bonus_questions q
      JOIN public.matches m ON m.id = q.match_id
      WHERE q.id = question_id
        AND m.status = 'upcoming'
        AND m.start_time > now()
    )
  );

-- =========================================================
-- updated_at triggery
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bets_updated BEFORE UPDATE ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bonus_answers_updated BEFORE UPDATE ON public.bonus_answers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- FUNKCJA: rozliczenie meczu (naliczanie punktów)
-- Wywoływana przez admina po wpisaniu wyniku.
-- =========================================================
CREATE OR REPLACE FUNCTION public.settle_match(_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  b RECORD;
  pts INTEGER;
  ba RECORD;
  qpts INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can settle matches';
  END IF;

  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m.winner IS NULL OR m.result_a IS NULL OR m.result_b IS NULL THEN
    RAISE EXCEPTION 'Match has no result yet';
  END IF;

  -- Zerujemy wcześniej naliczone punkty z tego meczu (idempotencja)
  UPDATE public.profiles p
    SET points = p.points - sub.total
  FROM (
    SELECT user_id, COALESCE(SUM(points_awarded),0) AS total
    FROM public.bets WHERE match_id = _match_id GROUP BY user_id
  ) sub
  WHERE p.id = sub.user_id;

  UPDATE public.profiles p
    SET points = p.points - sub.total
  FROM (
    SELECT ba.user_id, COALESCE(SUM(ba.points_awarded),0) AS total
    FROM public.bonus_answers ba
    JOIN public.bonus_questions q ON q.id = ba.question_id
    WHERE q.match_id = _match_id GROUP BY ba.user_id
  ) sub
  WHERE p.id = sub.user_id;

  UPDATE public.bets SET points_awarded = 0 WHERE match_id = _match_id;
  UPDATE public.bonus_answers SET points_awarded = 0
    WHERE question_id IN (SELECT id FROM public.bonus_questions WHERE match_id = _match_id);

  -- Naliczanie BETS
  FOR b IN SELECT * FROM public.bets WHERE match_id = _match_id LOOP
    pts := 0;
    IF b.predicted_winner = m.winner THEN
      pts := 1;
      IF b.predicted_score_a IS NOT NULL AND b.predicted_score_b IS NOT NULL
         AND b.predicted_score_a = m.result_a AND b.predicted_score_b = m.result_b THEN
        pts := 3;
      END IF;
    END IF;
    UPDATE public.bets SET points_awarded = pts WHERE id = b.id;
    UPDATE public.profiles SET points = points + pts WHERE id = b.user_id;
  END LOOP;

  -- Naliczanie BONUS ANSWERS
  FOR ba IN
    SELECT a.*, q.correct_answer
    FROM public.bonus_answers a
    JOIN public.bonus_questions q ON q.id = a.question_id
    WHERE q.match_id = _match_id
  LOOP
    qpts := 0;
    IF ba.correct_answer IS NOT NULL
       AND lower(trim(ba.answer)) = lower(trim(ba.correct_answer)) THEN
      qpts := 2;
    END IF;
    UPDATE public.bonus_answers SET points_awarded = qpts WHERE id = ba.id;
    UPDATE public.profiles SET points = points + qpts WHERE id = ba.user_id;
  END LOOP;

  UPDATE public.matches SET status = 'finished' WHERE id = _match_id;
END;
$$;
