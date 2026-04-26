-- Ukryj correct_answer przed graczami: publiczny widok bez tej kolumny + zawężenie polityki tabeli
DROP POLICY IF EXISTS "Public can view bonus questions" ON public.bonus_questions;

-- Pełny dostęp do tabeli tylko dla adminów (już mają policy "Admins manage bonus questions")
-- + autoryzowani/anon mogą czytać CAŁĄ tabelę tylko gdy mecz już się zakończył
CREATE POLICY "Public can view finished bonus questions"
  ON public.bonus_questions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = bonus_questions.match_id AND m.status = 'finished'
    )
  );

-- Widok zwracający pytania BEZ correct_answer (dla nadchodzących meczów)
CREATE OR REPLACE VIEW public.bonus_questions_public
WITH (security_invoker = true) AS
SELECT id, question, match_id, created_at
FROM public.bonus_questions;

GRANT SELECT ON public.bonus_questions_public TO anon, authenticated;