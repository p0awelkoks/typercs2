/**
 * Karta meczu — pokazuje drużyny, datę, status, formularz typowania.
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar, CheckCircle2, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Match = {
  id: string;
  team_a: string;
  team_b: string;
  team_a_logo: string | null;
  team_b_logo: string | null;
  tournament: string | null;
  start_time: string;
  status: "upcoming" | "finished";
  result_a: number | null;
  result_b: number | null;
  winner: string | null;
};

type BonusQ = { id: string; question: string; correct_answer: string | null };

export function MatchCard({
  match,
  bonusQuestions,
  onChange,
}: {
  match: Match;
  bonusQuestions: BonusQ[];
  onChange?: () => void;
}) {
  const { user } = useAuth();
  const [bet, setBet] = useState<{ winner: string; a: string; b: string; points?: number } | null>(null);
  const [bonusAns, setBonusAns] = useState<Record<string, { answer: string; points?: number }>>({});
  const [saving, setSaving] = useState(false);

  const start = new Date(match.start_time);
  const isLocked = match.status === "finished" || start.getTime() <= Date.now();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: b } = await supabase
        .from("bets")
        .select("predicted_winner, predicted_score_a, predicted_score_b, points_awarded")
        .eq("user_id", user.id)
        .eq("match_id", match.id)
        .maybeSingle();
      if (b) {
        setBet({
          winner: b.predicted_winner,
          a: b.predicted_score_a?.toString() ?? "",
          b: b.predicted_score_b?.toString() ?? "",
          points: b.points_awarded,
        });
      }
      if (bonusQuestions.length) {
        const { data: ans } = await supabase
          .from("bonus_answers")
          .select("question_id, answer, points_awarded")
          .eq("user_id", user.id)
          .in(
            "question_id",
            bonusQuestions.map((q) => q.id),
          );
        const map: Record<string, { answer: string; points?: number }> = {};
        ans?.forEach((a) => {
          map[a.question_id] = { answer: a.answer, points: a.points_awarded };
        });
        setBonusAns(map);
      }
    })();
  }, [user, match.id, bonusQuestions]);

  const saveBet = async (winner: string) => {
    if (!user || isLocked) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      match_id: match.id,
      predicted_winner: winner,
      predicted_score_a: bet?.a ? parseInt(bet.a) : null,
      predicted_score_b: bet?.b ? parseInt(bet.b) : null,
    };
    const { error } = await supabase.from("bets").upsert(payload, { onConflict: "user_id,match_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Typ zapisany!");
      setBet({ ...(bet ?? { a: "", b: "" }), winner });
      onChange?.();
    }
  };

  const saveScore = async () => {
    if (!user || isLocked || !bet?.winner) {
      toast.error("Najpierw wybierz zwycięzcę");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("bets").upsert(
      {
        user_id: user.id,
        match_id: match.id,
        predicted_winner: bet.winner,
        predicted_score_a: bet.a ? parseInt(bet.a) : null,
        predicted_score_b: bet.b ? parseInt(bet.b) : null,
      },
      { onConflict: "user_id,match_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Wynik zapisany!");
  };

  const saveBonus = async (qid: string, answer: string) => {
    if (!user || isLocked) return;
    const { error } = await supabase
      .from("bonus_answers")
      .upsert({ user_id: user.id, question_id: qid, answer }, { onConflict: "user_id,question_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Odpowiedź zapisana!");
      setBonusAns({ ...bonusAns, [qid]: { answer } });
    }
  };

  return (
    <div className="gaming-card p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {format(start, "d MMM yyyy, HH:mm", { locale: pl })}
        </div>
        {match.status === "finished" ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Zakończony
          </Badge>
        ) : isLocked ? (
          <Badge variant="outline" className="gap-1 border-warning text-warning">
            <Lock className="h-3 w-3" /> Zamknięty
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-primary text-primary">
            <Clock className="h-3 w-3" /> Nadchodzący
          </Badge>
        )}
      </div>

      {match.tournament && (
        <p className="mb-3 text-xs uppercase tracking-wider text-accent">{match.tournament}</p>
      )}

      <div className="mb-4 grid grid-cols-3 items-center gap-2">
        <TeamSide name={match.team_a} logo={match.team_a_logo} />
        <div className="text-center">
          {match.status === "finished" && match.result_a !== null ? (
            <div className="font-display text-3xl font-bold">
              <span className={match.winner === "A" ? "text-success" : ""}>{match.result_a}</span>
              <span className="mx-2 text-muted-foreground">:</span>
              <span className={match.winner === "B" ? "text-success" : ""}>{match.result_b}</span>
            </div>
          ) : (
            <div className="font-display text-2xl font-bold text-muted-foreground">VS</div>
          )}
        </div>
        <TeamSide name={match.team_b} logo={match.team_b_logo} alignRight />
      </div>

      {!user ? (
        <p className="text-center text-sm text-muted-foreground">Zaloguj się, aby typować</p>
      ) : (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Twój typ na zwycięzcę
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={bet?.winner === "A" ? "default" : "outline"}
                onClick={() => saveBet("A")}
                disabled={isLocked || saving}
                size="sm"
              >
                {match.team_a}
              </Button>
              <Button
                variant={bet?.winner === "B" ? "default" : "outline"}
                onClick={() => saveBet("B")}
                disabled={isLocked || saving}
                size="sm"
              >
                {match.team_b}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Dokładny wynik (opcjonalny, +3 pkt)
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={50}
                value={bet?.a ?? ""}
                onChange={(e) => setBet({ ...(bet ?? { winner: "", b: "" }), a: e.target.value })}
                disabled={isLocked}
                className="text-center"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                max={50}
                value={bet?.b ?? ""}
                onChange={(e) => setBet({ ...(bet ?? { winner: "", a: "" }), b: e.target.value })}
                disabled={isLocked}
                className="text-center"
              />
              <Button onClick={saveScore} disabled={isLocked || saving} size="sm" variant="secondary">
                Zapisz
              </Button>
            </div>
          </div>

          {bonusQuestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                ⭐ Pytanie bonusowe (+2 pkt)
              </p>
              {bonusQuestions.map((q) => (
                <div key={q.id} className="rounded-md bg-muted/50 p-3">
                  <p className="mb-2 text-sm">{q.question}</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Twoja odpowiedź"
                      defaultValue={bonusAns[q.id]?.answer ?? ""}
                      disabled={isLocked}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== bonusAns[q.id]?.answer) saveBonus(q.id, v);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {match.status === "finished" && bet?.points !== undefined && (
            <div className="rounded-md bg-success/10 p-3 text-center text-sm">
              Zdobyłeś{" "}
              <span className="font-bold text-success">{bet.points} pkt</span> za ten mecz
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamSide({ name, logo, alignRight }: { name: string; logo: string | null; alignRight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${alignRight ? "flex-row-reverse text-right" : ""}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold">
        {logo ? <img src={logo} alt={name} className="h-full w-full rounded-lg object-cover" /> : name[0]}
      </div>
      <span className="font-display text-base font-semibold leading-tight">{name}</span>
    </div>
  );
}
