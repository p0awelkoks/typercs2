function RankingPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, points")
        .order("points", { ascending: false });

      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">

      <h1 className="text-4xl font-bold mb-6">Ranking</h1>

      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-4 p-3 border">

          <div>{i + 1}</div>

          <Avatar>
            <AvatarImage src={r.avatar_url ?? undefined} />
            <AvatarFallback>
              {r.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            {r.username}
          </div>

          <div>{r.points}</div>

        </div>
      ))}

    </div>
  );
}
