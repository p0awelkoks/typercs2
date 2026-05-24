/**
 * Lista Discord ID, które powinny dostać rolę admina przy pierwszym logowaniu.
 *
 * UWAGA: Źródłem prawdy jest tabela `public.admin_discord_ids` w bazie.
 * Aby dodać admina:
 *  1) wstaw Discord ID do tabeli `admin_discord_ids` (np. INSERT INTO ...),
 *  2) opcjonalnie wpisz tu, żeby trzymać w jednym miejscu w repo.
 *
 * Lista jest tylko poglądowa — nie używamy jej do realnej autoryzacji
 * (autoryzacja działa przez tabelę `user_roles` + funkcję `has_role`).
 */
export const ADMIN_DISCORD_IDS: readonly string[] = [
  // "123456789012345678",
];
