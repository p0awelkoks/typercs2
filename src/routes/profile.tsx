function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // redirect
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // FETCH PROFILE (stable + no freeze)
  useEffect(() => {
    if (!user) return;

    let active = true;
    setProfileLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error(error);
        setProfile(null);
      } else {
        setProfile(data ?? null);
      }

      setProfileLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // FETCH BETS
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("bets")
        .select(`
          id,
          predicted_winner,
          predicted_score_a,
          predicted_score_b,
          points_awarded,
          matches(
            team_a,
            team_b,
            start_time,
            status,
            result_a,
            result_b,
            winner
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setBets((data as any) ?? []);
    })();
  }, [user?.id]);

  // sync form
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Zapisano");

    setProfile((p: any) =>
      p
        ? {
            ...p,
            username: username.trim(),
            avatar_url: avatarUrl || null,
          }
        : p
    );

    setEditing(false);
  };

  // 🔥 NEVER BLOCK UI ON PROFILE FETCH
  if (!user) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">

      <div className="gaming-card mb-8 p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">

          <Avatar className="h-24 w-24 ring-2 ring-primary glow-primary">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">
              {(profile?.username ?? "user").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center sm:text-left">

            <h1 className="font-display text-3xl font-bold">
              {profileLoading
                ? "Ładowanie..."
                : profile?.username ?? "user_" + user.id.slice(0, 6)}
            </h1>

            <p className="text-sm text-muted-foreground">
              {user.email}
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
              <Trophy className="h-5 w-5 text-accent" />
              <span className="font-display text-2xl font-bold">
                {profile?.points ?? 0}
              </span>
              <span className="text-sm text-muted-foreground">pkt</span>
            </div>

          </div>

          <Button variant="outline" onClick={() => setEditing(!editing)}>
            <Edit className="mr-2 h-4 w-4" />
            {editing ? "Anuluj" : "Edytuj"}
          </Button>

        </div>

        {editing && (
          <div className="mt-6 space-y-3 border-t border-border pt-6">

            <div>
              <Label>Nick</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <Label>Avatar</Label>
              <FileUpload
                bucket="avatars"
                folder={user.id}
                value={avatarUrl}
                onChange={setAvatarUrl}
                label="Wgraj zdjęcie"
              />
            </div>

            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Zapisuję..." : "Zapisz"}
            </Button>

          </div>
        )}
      </div>

      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
        <History className="h-5 w-5 text-primary" />
        Historia typów
      </h2>

      {bets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
          Nie masz jeszcze typów. Wybierz mecz!
        </p>
      ) : (
        <div className="space-y-2">
          {bets.map((b) => {
            const m = b.matches;
            const finished = m.status === "finished";
            const correctWinner =
              finished && b.predicted_winner === m.winner;

            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex-1">
                  <p className="font-display font-semibold">
                    {m.team_a} vs {m.team_b}
                  </p>
                </div>

                {finished ? (
                  <Badge variant={correctWinner ? "default" : "secondary"}>
                    +{b.points_awarded} pkt
                  </Badge>
                ) : (
                  <Badge variant="outline">Oczekuje</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
      }
