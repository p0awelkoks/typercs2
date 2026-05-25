function RankingPage() {
  const { user, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, points")
        .order("points", { ascending: false, nullsFirst: false });

      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">

      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-bold">
          <span className="gradient-text">Ranking</span> typerów
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Top 100 graczy globalnie
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Ładowanie...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground">Brak graczy.</p>
      ) : (
        <div className="space-y-2">

          {rows.map((r, i) => {
            const rank = i + 1;
            const isMe = user?.id === r.id;

            const displayName =
              r.username && r.username.trim().length > 0
                ? r.username
                : `user_${r.id.slice(0, 6)}`;

            return (
              <div
                key={r.id}
                className={`flex items-center gap-4 rounded-lg border bg-card p-4 transition hover:border-primary/50 ${
                  isMe ? "border-primary glow-primary" : "border-border"
                }`}
              >

                <RankBadge rank={rank} />

                <Avatar className="h-10 w-10">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold">
                    {displayName}
                    {isMe && (
                      <span className="ml-2 text-xs text-primary">(Ty)</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-accent" />
                  <span className="font-display text-lg font-bold">
                    {r.points ?? 0}
                  </span>
                </div>

              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}
