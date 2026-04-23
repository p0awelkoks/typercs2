/**
 * /ranking — globalna tablica liderów.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — CS2 Typer" },
      { name: "description", content: "Globalny ranking typerów CS2." },
    ],
  }),
  component: RankingPage,
});

type Row = { id: string; username: string | null; avatar_url: string | null; points: number };

function RankingPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, points")
        .order("points", { ascending: false })
        .limit(100);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-bold">
          <span className="gradient-text">Ranking</span> typerów
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Top 100 graczy globalnie</p>
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
                  <AvatarFallback>{(r.username ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold">
                    {r.username ?? "Anonim"} {isMe && <span className="text-xs text-primary">(Ty)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-accent" />
                  <span className="font-display text-lg font-bold">{r.points}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-background"><Medal className="h-5 w-5" /></div>;
  if (rank === 2)
    return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-background"><Medal className="h-5 w-5" /></div>;
  if (rank === 3)
    return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-700 text-background"><Medal className="h-5 w-5" /></div>;
  return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-display font-bold text-muted-foreground">{rank}</div>;
}
