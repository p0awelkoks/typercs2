CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  b RECORD;
  pts INTEGER;
  ba_id uuid;
  ba_user uuid;
  ba_answer text;
  ba_correct text;
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
    SELECT ba2.user_id, COALESCE(SUM(ba2.points_awarded),0) AS total
    FROM public.bonus_answers ba2
    JOIN public.bonus_questions q ON q.id = ba2.question_id
    WHERE q.match_id = _match_id GROUP BY ba2.user_id
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

  -- Naliczanie BONUS ANSWERS — używamy zmiennych skalarnych zamiast RECORD,
  -- żeby uniknąć błędu "record is not assigned yet" gdy pętla się nie wykona.
  FOR ba_id, ba_user, ba_answer, ba_correct IN
    SELECT a.id, a.user_id, a.answer, q.correct_answer
    FROM public.bonus_answers a
    JOIN public.bonus_questions q ON q.id = a.question_id
    WHERE q.match_id = _match_id
  LOOP
    qpts := 0;
    IF ba_correct IS NOT NULL
       AND lower(trim(ba_answer)) = lower(trim(ba_correct)) THEN
      qpts := 2;
    END IF;
    UPDATE public.bonus_answers SET points_awarded = qpts WHERE id = ba_id;
    UPDATE public.profiles SET points = points + qpts WHERE id = ba_user;
  END LOOP;

  UPDATE public.matches SET status = 'finished' WHERE id = _match_id;
END;
$function$;