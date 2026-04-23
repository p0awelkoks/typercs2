/**
 * Strona główna — lista nadchodzących i zakończonych meczów z możliwością typowania.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatchCard } from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CS2 Typer — Typuj mecze Counter-Strike 2" },
      { name: "description", content: "Typuj wyniki meczów CS2, zdobywaj punkty i rywalizuj w globalnym rankingu." },
      { property: "og:title", content: "CS2 Typer — Typuj mecze Counter-Strike 2" },
      { property: "og:description", content: "Typuj wyniki meczów CS2, zdobywaj punkty i rywalizuj w globalnym rankingu." },
    ],
  }),
  component: HomePage,
});

type Match = {
  id: string;
  team_a: string; team_b: string;
  team_a_logo: string | null; team_b_logo: string | null;
  tournament: string | null;
  start_time: string;
  status: "upcoming" | "finished";
  result_a: number | null; result_b: number | null; winner: string | null;
};

function HomePage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [bonus, setBonus] = useState<Record<string, { id: string; question: string; correct_answer: string | null }[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: m } = await supabase
      .from("matches")
      .select("*")
      .order("start_time", { ascending: true });
    setMatches((m as Match[]) ?? []);

    const { data: q } = await supabase
      .from("bonus_questions")
      .select("id, question, correct_answer, match_id");
    const map: Record<string, { id: string; question: string; correct_answer: string | null }[]> = {};
    q?.forEach((x: any) => {
      (map[x.match_id] ??= []).push({ id: x.id, question: x.question, correct_answer: x.correct_answer });
    });
    setBonus(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const upcoming = matches.filter((m) => m.status === "upcoming");
  const finished = matches.filter((m) => m.status === "finished").reverse();

  return (
    <div className="container mx-auto px-4 py-8">
      <section className="mb-10 text-center">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">
          Typuj mecze <span className="gradient-text">CS2</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          +1 pkt za zwycięzcę · +3 pkt za dokładny wynik · +2 pkt za pytanie bonusowe
        </p>
      </section>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">Nadchodzące ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="finished">Zakończone ({finished.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {loading ? (
            <Grid><CardSkeletons /></Grid>
          ) : upcoming.length === 0 ? (
            <Empty text="Brak nadchodzących meczów. Wróć później!" />
          ) : (
            <Grid>
              {upcoming.map((m) => (
                <MatchCard key={m.id} match={m} bonusQuestions={bonus[m.id] ?? []} onChange={load} />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="finished">
          {finished.length === 0 ? (
            <Empty text="Brak zakończonych meczów." />
          ) : (
            <Grid>
              {finished.map((m) => (
                <MatchCard key={m.id} match={m} bonusQuestions={bonus[m.id] ?? []} />
              ))}
            </Grid>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">{text}</div>;
}
function CardSkeletons() {
  return (
    <>
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-full" />)}
    </>
  );
}
