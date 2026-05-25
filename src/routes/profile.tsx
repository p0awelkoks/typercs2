/**
 * /profile — profil zalogowanego usera: avatar, punkty, historia typów.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, History, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Mój profil — CS2 Typer" }] }),
  component: ProfilePage,
});

type BetRow = {
  id: string;
  predicted_winner: string;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  points_awarded: number;
  matches: {
    team_a: string; team_b: string; start_time: string;
    status: string; result_a: number | null; result_b: number | null; winner: string | null;
  };
};

function ProfilePage() {
  const { user, profile: ctxProfile, loading, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(ctxProfile);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Pobierz profil bezpośrednio z DB (źródło prawdy), nie polegaj wyłącznie na AuthContext
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, ctxProfile]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("bets")
        .select("id, predicted_winner, predicted_score_a, predicted_score_b, points_awarded, matches(team_a, team_b, start_time, status, result_a, result_b, winner)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setBets((data as any) ?? []);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: username.trim(), avatar_url: avatarUrl || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Zapisano"); await refreshProfile(); setEditing(false); }
  };

  if (!profile) return <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">Ładowanie...</div>;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="gaming-card mb-8 p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Avatar className="h-24 w-24 ring-2 ring-primary glow-primary">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{(profile.username ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-display text-3xl font-bold">{profile.username ?? "Bez nicku"}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
              <Trophy className="h-5 w-5 text-accent" />
              <span className="font-display text-2xl font-bold">{profile.points}</span>
              <span className="text-sm text-muted-foreground">pkt</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            <Edit className="mr-2 h-4 w-4" /> {editing ? "Anuluj" : "Edytuj"}
          </Button>
        </div>

        {editing && (
          <div className="mt-6 space-y-3 border-t border-border pt-6">
            <div>
              <Label htmlFor="u">Nick</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <Label>Avatar</Label>
              <FileUpload
                bucket="avatars"
                folder={user?.id}
                value={avatarUrl}
                onChange={setAvatarUrl}
                label="Wgraj zdjęcie"
              />
            </div>
            <Button onClick={saveProfile} disabled={saving}>{saving ? "Zapisuję..." : "Zapisz"}</Button>
          </div>
        )}
      </div>

      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
        <History className="h-5 w-5 text-primary" /> Historia typów
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
            const correctWinner = finished && b.predicted_winner === m.winner;
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex-1">
                  <p className="font-display font-semibold">{m.team_a} vs {m.team_b}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(m.start_time), "d MMM yyyy, HH:mm", { locale: pl })}</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Typ: </span>
                  <span className="font-semibold">{b.predicted_winner === "A" ? m.team_a : m.team_b}</span>
                  {b.predicted_score_a !== null && b.predicted_score_b !== null && (
                    <span className="ml-2 text-muted-foreground">({b.predicted_score_a}:{b.predicted_score_b})</span>
                  )}
                </div>
                {finished ? (
                  <Badge variant={correctWinner ? "default" : "secondary"} className={correctWinner ? "bg-success text-success-foreground" : ""}>
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
