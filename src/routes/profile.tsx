function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // redirect
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading]);

  // PROFILE = DB ONLY
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error) setProfile(data);
    })();
  }, [user?.id]);

  // BETS
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setBets((data as any) ?? []);
    })();
  }, [user?.id]);

  // sync form
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const saveProfile = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    if (!error) {
      setProfile((p: any) => ({
        ...p,
        username,
        avatar_url: avatarUrl,
      }));
      setEditing(false);
    }
  };

  if (!user) return null;
  if (!profile) return null; // 🔥 NO LOADING UI

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">

      <div className="gaming-card p-6">

        <Avatar className="h-24 w-24">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback>
            {profile.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-3xl font-bold mt-4">
          {profile.username}
        </h1>

        <p className="text-muted-foreground">{user.email}</p>

        <div className="mt-3 text-xl font-bold">
          {profile.points} pkt
        </div>

        <Button onClick={() => setEditing(!editing)}>
          {editing ? "Anuluj" : "Edytuj"}
        </Button>

        {editing && (
          <div className="mt-4 space-y-2">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            <FileUpload
              bucket="avatars"
              folder={user.id}
              value={avatarUrl}
              onChange={setAvatarUrl}
            />
            <Button onClick={saveProfile}>Zapisz</Button>
          </div>
        )}

      </div>

      <h2 className="mt-6 text-2xl font-bold">Historia</h2>

      <div className="space-y-2 mt-2">
        {bets.map((b) => (
          <div key={b.id} className="border p-3 rounded">
            {b.id}
          </div>
        ))}
      </div>

    </div>
  );
}
