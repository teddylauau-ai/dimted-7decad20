import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Play, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { IdentityRow } from "@/components/dimted/Identity";
import { NovaBlocks } from "@/components/games/NovaBlocks";
import { AuroraDrift } from "@/components/games/AuroraDrift";
import { PulseGrid } from "@/components/games/PulseGrid";
import { GAMES, type GameId } from "@/lib/games";
import {
  personalBest,
  useLeaderboard,
  useMyScores,
  useSubmitScore,
} from "@/lib/games-queries";
import { useDimted } from "@/lib/dimted-store";
import { useRefreshDimted } from "@/lib/dimted-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Arcade — Dimted" },
      {
        name: "description",
        content:
          "Three real minigames you can play right now: Nova Blocks, Aurora Drift and Pulse Grid. Every run earns XP and lands on the leaderboard.",
      },
      { property: "og:title", content: "Dimted Arcade" },
      {
        property: "og:description",
        content: "Nova Blocks, Aurora Drift, Pulse Grid — play solo, climb the leaderboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArcadePage,
});

type Phase = "idle" | "playing" | "over";

function ArcadePage() {
  const { profile, award, surgeActive } = useDimted();
  const [gameId, setGameId] = useState<GameId>("nova-blocks");
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [runKey, setRunKey] = useState(0);

  const board = useLeaderboard(gameId);
  const myScores = useMyScores(profile?.id);
  const submit = useSubmitScore(profile?.id);
  const refresh = useRefreshDimted();

  const game = GAMES.find((g) => g.id === gameId)!;
  const best = personalBest(myScores.data, gameId);
  const isNewBest = phase === "over" && score > best;

  const start = () => {
    setScore(0);
    setRunKey((k) => k + 1);
    setPhase("playing");
  };

  const end = useCallback(
    async (finalScore: number) => {
      setScore(finalScore);
      setPhase("over");
      if (finalScore <= 0) return;
      try {
        await submit.mutateAsync({ game: gameId, score: finalScore });
      } catch {
        toast.error("Couldn't save that score");
      }
      const result = await award("activity", `${game.name} · ${Math.round(finalScore)}`);
      if (result === "granted") {
        toast.success(`Run saved${surgeActive ? " — double XP from your surge" : ""}.`);
        refresh();
      } else if (result === "capped") {
        toast("Score saved. You've hit today's XP cap — keep playing for the leaderboard.");
      } else if (result === "cooldown") {
        toast("Score saved. XP again in a moment.");
      }
    },
    [award, game.name, gameId, refresh, submit, surgeActive],
  );

  const playing = phase === "playing";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Arcade"
        title="Play something"
        blurb="Three real games. No partner needed, no waiting — press start and go. Every run earns XP and lands on the leaderboard."
      />

      {/* Game picker */}
      <div className="grid gap-3 md:grid-cols-3">
        {GAMES.map((g, i) => {
          const selected = g.id === gameId;
          const gBest = personalBest(myScores.data, g.id);
          return (
            <button
              key={g.id}
              onClick={() => {
                setGameId(g.id);
                setPhase("idle");
                setScore(0);
              }}
              className={cn(
                "glass animate-rise rounded-2xl p-4 text-left transition-colors",
                selected ? "ring-primary/60 ring-2" : "hover:bg-secondary/40",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight">{g.name}</h3>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  best {gBest.toLocaleString()}
                </span>
              </div>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{g.tagline}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Play surface */}
        <Panel className="relative flex flex-col items-center gap-4 p-5">
          <div className="flex w-full items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Now playing</p>
              <h2 className="font-display mt-1 text-lg font-semibold tracking-tight">{game.name}</h2>
              <p className="text-muted-foreground mt-1 font-mono text-[11px]">{game.controls}</p>
            </div>
            {playing ? (
              <Button variant="outline" size="sm" onClick={() => void end(score)}>
                End run
              </Button>
            ) : null}
          </div>

          <div className="relative w-full">
            {playing ? (
              <div key={runKey} className="flex justify-center">
                {gameId === "nova-blocks" ? (
                  <NovaBlocks running onScore={setScore} onEnd={(s) => void end(s)} />
                ) : gameId === "aurora-drift" ? (
                  <AuroraDrift running onScore={setScore} onEnd={(s) => void end(s)} />
                ) : (
                  <PulseGrid running onScore={setScore} onEnd={(s) => void end(s)} />
                )}
              </div>
            ) : (
              <div className="border-border bg-background/40 flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6 text-center">
                {phase === "over" ? (
                  <>
                    <p className="eyebrow">{isNewBest ? "New personal best" : "Run over"}</p>
                    <p className="numeral text-5xl">{Math.round(score).toLocaleString()}</p>
                    <p className="text-muted-foreground text-sm">
                      Your best is {Math.max(best, Math.round(score)).toLocaleString()}.
                    </p>
                    <Button onClick={start}>
                      <RotateCcw className="size-4" /> Play again
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">{game.how}</p>
                    <Button onClick={start}>
                      <Play className="size-4" /> Start {game.name}
                    </Button>
                    {best > 0 ? (
                      <p className="text-muted-foreground font-mono text-[11px]">
                        your best · {best.toLocaleString()}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        </Panel>

        {/* Leaderboard */}
        <Panel className="p-5">
          <PanelHead
            eyebrow="Leaderboard"
            title={game.name}
            aside={<Trophy className="text-gold size-4" />}
          />
          {board.isLoading ? (
            <p className="text-muted-foreground mt-4 font-mono text-[11px]">Loading…</p>
          ) : (board.data ?? []).length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nobody has scored here yet. First run sets the bar.
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {(board.data ?? []).slice(0, 10).map((row, i) => (
                <li
                  key={row.id}
                  className={cn(
                    "border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-2",
                    row.profile?.id === profile?.id && "border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "numeral w-5 shrink-0 text-sm",
                      i === 0 && "text-gold",
                      i > 0 && "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {row.profile ? <IdentityRow profile={row.profile} size={26} /> : null}
                  </div>
                  <span className="numeral shrink-0 text-sm">{row.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
