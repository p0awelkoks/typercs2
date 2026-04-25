/**
 * /admin — panel administratora.
 * - Dodawanie meczy
 * - Dodawanie pytań bonusowych do meczu
 * - Wprowadzanie wyników i automatyczne rozliczanie (settle_match RPC)
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, PlusCircle, Star, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { FileUpload } from "@/components/FileUpload";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — CS2 Typer" }] }),
  component: AdminPage,
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
type BQ = { id: string; match_id: string; question: string; correct_answer: string | null };

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [questions, setQuestions] = useState<BQ[]>([]);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [isAdmin, loading, navigate]);

  const load = async () => {
    const [{ data: m }, { data: q }] = await Promise.all([
      supabase.from("matches").select("*").order("start_time", { ascending: false }),
      supabase.from("bonus_questions").select("*"),
    ]);
    setMatches((m as Match[]) ?? []);
    setQuestions((q as BQ[]) ?? []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 flex items-center gap-3 font-display text-4xl font-bold">
        <Shield className="h-9 w-9 text-primary" />
        Panel <span className="gradient-text">admina</span>
      </h1>

      <Tabs defaultValue="add">
        <TabsList>
          <TabsTrigger value="add">Dodaj mecz</TabsTrigger>
          <TabsTrigger value="manage">Zarządzaj ({matches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="mt-6">
          <AddMatchForm onAdded={load} />
        </TabsContent>

        <TabsContent value="manage" className="mt-6 space-y-4">
          {matches.map((m) => (
            <AdminMatchRow
              key={m.id}
              match={m}
              questions={questions.filter((q) => q.match_id === m.id)}
              onChange={load}
            />
          ))}
          {matches.length === 0 && <p className="text-center text-muted-foreground">Brak meczów.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddMatchForm({ onAdded }: { onAdded: () => void }) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [tournament, setTournament] = useState("");
  const [date, setDate] = useState("");
  const [logoA, setLogoA] = useState("");
  const [logoB, setLogoB] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamA || !teamB || !date) { toast.error("Wypełnij wymagane pola"); return; }
    setSaving(true);
    const { error } = await supabase.from("matches").insert({
      team_a: teamA, team_b: teamB,
      team_a_logo: logoA || null, team_b_logo: logoB || null,
      tournament: tournament || null,
      start_time: new Date(date).toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Mecz dodany"); setTeamA(""); setTeamB(""); setTournament(""); setDate(""); setLogoA(""); setLogoB(""); onAdded(); }
  };

  return (
    <form onSubmit={submit} className="gaming-card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Drużyna A *</Label><Input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="np. NaVi" /></div>
        <div><Label>Drużyna B *</Label><Input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="np. FaZe" /></div>
        <div><Label>Logo A (URL)</Label><Input value={logoA} onChange={(e) => setLogoA(e.target.value)} /></div>
        <div><Label>Logo B (URL)</Label><Input value={logoB} onChange={(e) => setLogoB(e.target.value)} /></div>
        <div><Label>Turniej</Label><Input value={tournament} onChange={(e) => setTournament(e.target.value)} placeholder="IEM Katowice 2025" /></div>
        <div><Label>Data i godzina *</Label><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <Button type="submit" disabled={saving}>
        <PlusCircle className="mr-2 h-4 w-4" /> {saving ? "Dodaję..." : "Dodaj mecz"}
      </Button>
    </form>
  );
}

function AdminMatchRow({ match, questions, onChange }: { match: Match; questions: BQ[]; onChange: () => void }) {
  const [resA, setResA] = useState(match.result_a?.toString() ?? "");
  const [resB, setResB] = useState(match.result_b?.toString() ?? "");
  const [bonusQ, setBonusQ] = useState("");
  const [bonusAns, setBonusAns] = useState("");

  const settle = async () => {
    const a = parseInt(resA), b = parseInt(resB);
    if (isNaN(a) || isNaN(b)) { toast.error("Wpisz wynik"); return; }
    const winner = a > b ? "A" : b > a ? "B" : null;
    if (!winner) { toast.error("Remis niemożliwy w CS2"); return; }
    const { error: e1 } = await supabase.from("matches")
      .update({ result_a: a, result_b: b, winner }).eq("id", match.id);
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await supabase.rpc("settle_match", { _match_id: match.id });
    if (e2) toast.error(e2.message);
    else { toast.success("Mecz rozliczony, punkty naliczone!"); onChange(); }
  };

  const addBonus = async () => {
    if (!bonusQ.trim()) return;
    const { error } = await supabase.from("bonus_questions").insert({
      match_id: match.id, question: bonusQ.trim(), correct_answer: bonusAns.trim() || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Pytanie dodane"); setBonusQ(""); setBonusAns(""); onChange(); }
  };

  const updateBonusAns = async (id: string, val: string) => {
    const { error } = await supabase.from("bonus_questions").update({ correct_answer: val.trim() || null }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Zaktualizowano");
  };

  const delBonus = async (id: string) => {
    const { error } = await supabase.from("bonus_questions").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Usunięto"); onChange(); }
  };

  const delMatch = async () => {
    if (!confirm("Usunąć mecz?")) return;
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    if (error) toast.error(error.message); else { toast.success("Usunięto"); onChange(); }
  };

  return (
    <div className="gaming-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{match.team_a} vs {match.team_b}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(match.start_time), "d MMM yyyy, HH:mm", { locale: pl })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={match.status === "finished" ? "secondary" : "outline"}>{match.status === "finished" ? "Zakończony" : "Nadchodzący"}</Badge>
          <Button size="icon" variant="ghost" onClick={delMatch}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div><Label className="text-xs">Wynik {match.team_a}</Label><Input className="w-20" type="number" value={resA} onChange={(e) => setResA(e.target.value)} /></div>
        <span className="pb-2 text-muted-foreground">:</span>
        <div><Label className="text-xs">Wynik {match.team_b}</Label><Input className="w-20" type="number" value={resB} onChange={(e) => setResB(e.target.value)} /></div>
        <Button onClick={settle} variant="default">Zapisz wynik i nalicz punkty</Button>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent">
          <Star className="h-3.5 w-3.5" /> Pytania bonusowe (+2 pkt)
        </p>
        {questions.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2">
            <p className="flex-1 text-sm">{q.question}</p>
            <Input
              defaultValue={q.correct_answer ?? ""}
              placeholder="Poprawna odpowiedź"
              className="w-48"
              onBlur={(e) => { if (e.target.value.trim() !== (q.correct_answer ?? "")) updateBonusAns(q.id, e.target.value); }}
            />
            <Button size="icon" variant="ghost" onClick={() => delBonus(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Treść pytania..." value={bonusQ} onChange={(e) => setBonusQ(e.target.value)} className="flex-1 min-w-[200px]" />
          <Input placeholder="Poprawna odp. (opcjonalnie)" value={bonusAns} onChange={(e) => setBonusAns(e.target.value)} className="w-56" />
          <Button onClick={addBonus} variant="secondary"><PlusCircle className="mr-2 h-4 w-4" /> Dodaj</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Poprawną odpowiedź możesz dodać/zmienić również po meczu — rozliczenie jest idempotentne.
        </p>
      </div>
    </div>
  );
}
