import { useCallback, useMemo, useRef, useState } from "react";
import { Lock, Play, RotateCcw, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead } from "@/components/dimted/primitives";
import { IdentityRow } from "@/components/dimted/Identity";
import { NovaBlocks } from "@/components/games/NovaBlocks";
import { AuroraDrift } from "@/components/games/AuroraDrift";
import { PrismBreak } from "@/components/games/PrismBreak";
import { CometSling } from "@/components/games/CometSling";
import { NovaFusion } from "@/components/games/NovaFusion";
import { TowerStack } from "@/components/games/TowerStack";
import { LaneHop } from "@/components/games/LaneHop";
import { NeonCoil } from "@/components/games/NeonCoil";
import { NovaRift } from "@/components/games/NovaRift";
import { GAMES, gamesByXp, parXp, type GameId } from "@/lib/games";
import {
  LEVELS,
  TOTAL_STARS,
  UNLOCK_AT,
  abilityNote,
  levelScore,
  masteryFor,
  starsFor,
} from "@/lib/campaign";
import {
  bestMsAt,
  highestCleared,
  starsAt,
  totalStars,
  useCampaignProgress,
  useRiftLeaderboard,
  useSaveClear,
} from "@/lib/campaign-queries";
import { RIFT_RUNNERS, RIFT_TRAILS } from "@/lib/rift-skins";
import {
  levelSlug,
  useRiftBuy,
  useRiftEquip,
  useRiftShop,
  useRiftState,
} from "@/lib/rift-queries";


import {
  awardArcadeXp,
  personalBest,
  useLeaderboard,
  useMyScores,
  useTopGamePlayers,
  useSubmitScore,
  type ArcadeReward,
} from "@/lib/games-queries";
import { useDimted } from "@/lib/dimted-store";
import { useRefreshDimted } from "@/lib/dimted-queries";
import { cn } from "@/lib/utils";


type Phase = "idle" | "playing" | "over";

// ------------------------------------------------------------------ Campaign

export function CampaignSection() {
  const { profile, surgeActive, syncXp } = useDimted();
  const progress = useCampaignProgress(profile?.id);
  const saveClear = useSaveClear(profile?.id);
  const submit = useSubmitScore(profile?.id);
  const refresh = useRefreshDimted();

  const riftState = useRiftState(profile?.id);
  const shop = useRiftShop();
  const buy = useRiftBuy(profile?.id);
  const equip = useRiftEquip(profile?.id);

  const cleared = highestCleared(progress.data);
  const stars = totalStars(progress.data);
  const owned = riftState.data?.unlocks ?? [];
  const spendable = riftState.data?.starsAvailable ?? 0;
  const skin = { runner: riftState.data?.runner ?? "aurora", trail: riftState.data?.trail ?? "ghost" };
  const priceOf = (slug: string) => shop.data?.find((i) => i.slug === slug)?.cost_stars ?? 0;
  const isOpen = (n: number) => n <= cleared + 1 || owned.includes(levelSlug(n));
  const unlockedUpTo = Math.min(LEVELS.length, cleared + 1);

  const [levelN, setLevelN] = useState(1);
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "won" | "lost">("idle");
  const [result, setResult] = useState<{ stars: number; ms: number; shards: number } | null>(null);
  const board = useRiftLeaderboard();

  const purchase = async (slug: string, label: string) => {
    try {
      const res = await buy.mutateAsync(slug);
      if (res.status === "bought") toast.success(`${label} unlocked`);
      else if (res.status === "owned") toast(`You already own ${label}`);
      else if (res.status === "poor") toast.error(`Need ${res.need} stars — you have ${res.have}`);
      else toast.error("Couldn't unlock that");
    } catch {
      toast.error("Couldn't unlock that");
    }
  };

  const pickRunner = async (slug: string) => {
    try {
      const res = await equip.mutateAsync({ kind: "runner", slug });
      if (res.status === "locked") toast.error("Unlock that runner first");
    } catch {
      toast.error("Couldn't switch runner");
    }
  };
  const pickTrail = async (slug: string) => {
    try {
      const res = await equip.mutateAsync({ kind: "trail", slug });
      if (res.status === "locked") toast.error("Unlock that trail first");
    } catch {
      toast.error("Couldn't switch trail");
    }
  };

  const level = LEVELS.find((l) => l.n === levelN)!;
  const locked = !isOpen(levelN);



  const start = (n = levelN) => {
    setLevelN(n);
    setResult(null);
    setRunKey((k) => k + 1);
    setPhase("playing");
  };

  const win = useCallback(
    async (shards: number, ms: number) => {
      const earned = starsFor(level, shards, ms);
      setResult({ stars: earned, ms, shards });
      setPhase("won");
      try {
        await saveClear.mutateAsync({ level: level.n, stars: earned, ms });
      } catch {
        toast.error("Couldn't save that clear");
      }
      const score = levelScore(level, earned, ms);
      try {
        await submit.mutateAsync({ game: "nova-rift" as GameId, score });
      } catch {
        /* leaderboard save is best-effort */
      }
      try {
        const res = await awardArcadeXp("nova-rift" as GameId, score);
        if (res.status === "awarded" || res.status === "granted") {
          syncXp(res, `Nova Rift level ${level.n}`);
          toast.success(
            `Level ${level.n} cleared · +${res.gained} XP · +${res.sparks_gained} sparks` +
              (surgeActive ? " · surge doubled" : ""),
          );
          refresh();
        } else if (res.status === "cooldown") {
          toast("Cleared. XP again in under a minute.");
        } else if (res.status === "capped") {
          toast("Cleared. Today's XP is maxed — stars still count.");
        }
      } catch {
        toast("Level cleared.");
      }
      const note = abilityNote(level.n + 1);
      if (note && level.n === cleared) toast(note);
    },
    [cleared, level, refresh, saveClear, submit, surgeActive, syncXp],
  );

  const winRef = useRef(win);
  winRef.current = win;
  const handleWin = useCallback((shards: number, ms: number) => void winRef.current(shards, ms), []);
  const handleFail = useCallback(() => setPhase("lost"), []);

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <PanelHead
          eyebrow="Campaign progress"
          title={`Level ${unlockedUpTo} of ${LEVELS.length}`}
          aside={
            <span className="text-gold flex items-center gap-1.5 font-mono text-[11px]">
              <Star className="size-3.5 fill-current" />
              {stars}/{TOTAL_STARS}
            </span>
          }
        />
        <div className="bg-secondary/50 mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${(stars / TOTAL_STARS) * 100}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          One star for clearing, one for every shard, one for beating par. Double Jump unlocks at level
          5, Dash at level 9.
        </p>
      </Panel>

      {/* Level select — locked levels can be bought with stars */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {LEVELS.map((l) => {
          const isLocked = !isOpen(l.n);
          const price = priceOf(levelSlug(l.n));
          const got = starsAt(progress.data, l.n);
          return (
            <div
              key={l.n}
              className={cn(
                "glass rounded-xl p-3 text-left transition-colors",
                l.n === levelN && !isLocked && "ring-primary/60 ring-2",
              )}
            >
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setLevelN(l.n);
                  setPhase("idle");
                  setResult(null);
                }}
                className={cn("w-full text-left", isLocked && "cursor-not-allowed opacity-60")}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="numeral text-sm">{l.n}</span>
                  {isLocked ? (
                    <Lock className="text-muted-foreground size-3.5" />
                  ) : (
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <Star
                          key={i}
                          className={cn("size-3", i < got ? "text-gold fill-current" : "text-muted-foreground/40")}
                        />
                      ))}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] leading-tight">{l.name}</p>
              </button>
              {isLocked && price > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={buy.isPending || spendable < price}
                  onClick={() => void purchase(levelSlug(l.n), `Level ${l.n}`)}
                  className="mt-2 h-7 w-full px-2 text-[11px]"
                >
                  <Star className="size-3 fill-current" /> {price}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>


      <Panel className="flex flex-col items-center gap-4 p-5">
        {phase === "playing" ? (
          <div key={runKey} className="w-full">
            <NovaRift
              level={level}
              running
              onWin={handleWin}
              onFail={handleFail}
              runner={skin.runner}
              trail={skin.trail}
            />

            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setPhase("idle")}>
                Quit level
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-border bg-background/40 flex min-h-[380px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6 text-center">
            {phase === "won" && result ? (
              <>
                <p className="eyebrow">Level {level.n} cleared</p>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-7",
                        i < result.stars ? "text-gold fill-current" : "text-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm">
                  {(result.ms / 1000).toFixed(1)}s · {result.shards}/{level.shards.length} shards · par{" "}
                  {(level.parMs / 1000).toFixed(0)}s
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => start(level.n)} variant="outline">
                    <RotateCcw className="size-4" /> Replay
                  </Button>
                  {level.n < LEVELS.length ? (
                    <Button onClick={() => start(level.n + 1)}>
                      <Play className="size-4" /> Level {level.n + 1}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : phase === "lost" ? (
              <>
                <p className="eyebrow">Rift collapsed</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Level {level.n} · {level.name}. Spikes, saws and pits all reset the run — nothing else
                  can hurt you.
                </p>
                <Button onClick={() => start(level.n)}>
                  <RotateCcw className="size-4" /> Try again
                </Button>
              </>
            ) : locked ? (
              <>
                <p className="eyebrow">Locked</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Clear level {unlockedUpTo} to open this one.
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow">Level {level.n}</p>
                <h2 className="font-display text-lg font-semibold tracking-tight">{level.name}</h2>
                <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                  Reach the gold beam. Collect {level.shards.length} shards and finish under{" "}
                  {(level.parMs / 1000).toFixed(0)}s for all three stars.
                </p>
                <p className="text-muted-foreground font-mono text-[11px]">
                  ← → move · Space / ↑ jump{level.n >= 5 ? " (double jump)" : ""}
                  {level.n >= 9 ? " · Shift dash" : ""}
                </p>
                {bestMsAt(progress.data, level.n) ? (
                  <p className="text-muted-foreground font-mono text-[11px]">
                    your best · {((bestMsAt(progress.data, level.n) ?? 0) / 1000).toFixed(1)}s
                  </p>
                ) : null}
                <Button onClick={() => start(level.n)}>
                  <Play className="size-4" /> Start level
                </Button>
              </>
            )}
          </div>
        )}
      </Panel>

      {/* Runners + trails, earned with stars */}
      <Panel className="p-4 sm:p-5">
        <PanelHead
          eyebrow="Rift wardrobe"
          title="Runners & trails"
          aside={
            <span className="text-muted-foreground font-mono text-[11px]">{stars} stars earned</span>
          }
        />
        <p className="text-muted-foreground mt-2 text-xs">
          Earned by playing — collect stars to open new runners and trails.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {RIFT_RUNNERS.map((r) => {
            const isLocked = stars < r.stars;
            const on = skin.runner === r.slug;
            return (
              <button
                key={r.slug}
                type="button"
                disabled={isLocked}
                onClick={() => pickRunner(r.slug)}
                className={cn(
                  "glass rounded-xl p-3 text-left transition-colors",
                  on && "ring-primary/60 ring-2",
                  isLocked ? "cursor-not-allowed opacity-45" : "hover:bg-secondary/40",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-5 rounded-full"
                    style={{ background: r.body, boxShadow: `0 0 10px ${r.body}` }}
                  />
                  <span className="truncate text-xs font-medium">{r.name}</span>
                  {isLocked ? <Lock className="text-muted-foreground ml-auto size-3.5" /> : null}
                </span>
                <p className="text-muted-foreground mt-1 truncate text-[11px]">
                  {isLocked ? `${r.stars} stars` : r.blurb}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {RIFT_TRAILS.map((t) => {
            const isLocked = stars < t.stars;
            const on = skin.trail === t.slug;
            return (
              <button
                key={t.slug}
                type="button"
                disabled={isLocked}
                onClick={() => pickTrail(t.slug)}
                className={cn(
                  "glass rounded-xl p-3 text-left transition-colors",
                  on && "ring-primary/60 ring-2",
                  isLocked ? "cursor-not-allowed opacity-45" : "hover:bg-secondary/40",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-8 rounded-full"
                    style={{
                      background:
                        t.style === "prism"
                          ? "linear-gradient(90deg,#7ce7ff,#c9a5ff,#ff8fb8)"
                          : `linear-gradient(90deg, transparent, ${t.color})`,
                    }}
                  />
                  <span className="truncate text-xs font-medium">{t.name}</span>
                  {isLocked ? <Lock className="text-muted-foreground ml-auto size-3.5" /> : null}
                </span>
                <p className="text-muted-foreground mt-1 truncate text-[11px]">
                  {isLocked ? `${t.stars} stars` : t.blurb}
                </p>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Nova Rift ladder */}
      <Panel className="p-4 sm:p-5">
        <PanelHead
          eyebrow="Nova Rift ladder"
          title="Top rift runners"
          aside={<Trophy className="text-gold size-4" />}
        />
        <div className="mt-3 space-y-1">
          {board.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading the ladder…</p>
          ) : (board.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No clears yet — set the first time.</p>
          ) : (
            (board.data ?? []).map((row, i) => (
              <div
                key={row.userId}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2",
                  row.userId === profile?.id ? "bg-primary/10" : "hover:bg-secondary/30",
                )}
              >
                <span className="numeral text-muted-foreground w-6 text-xs">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <IdentityRow
                    profile={{
                      username: row.username,
                      display_name: row.displayName,
                      avatar_url: row.avatarUrl,
                      equipped_nametag: row.equippedNametag,
                      equipped_badge: row.equippedBadge,
                      equipped_frame: row.equippedFrame,
                    }}
                  />
                </div>
                <span className="text-gold flex items-center gap-1 font-mono text-[11px]">
                  <Star className="size-3 fill-current" />
                  {row.stars}
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  lvl {row.cleared} · {(row.totalMs / 1000).toFixed(0)}s
                </span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>

  );
}

// -------------------------------------------------------------------- Arcade

export function ArcadeSection() {
  const { profile, surgeActive, syncXp } = useDimted();
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

  // Mastery ranks across all games decide which games are unlocked.
  const mastery = useMemo(
    () =>
      gamesByXp().map((g) => ({
        game: g,
        best: personalBest(myScores.data, g.id),
        ...masteryFor(personalBest(myScores.data, g.id), g.xpPerScore),
      })),
    [myScores.data],
  );
  const totalRanks = mastery.reduce((sum, m) => sum + m.rank, 0);
  const current = mastery.find((m) => m.game.id === gameId)!;
  const gameLocked = totalRanks < (UNLOCK_AT[gameId] ?? 0);

  const [reward, setReward] = useState<ArcadeReward | null>(null);

  const start = () => {
    setScore(0);
    setReward(null);
    setRunKey((k) => k + 1);
    setPhase("playing");
  };

  const end = useCallback(
    async (finalScore: number) => {
      setScore(finalScore);
      setPhase("over");
      setReward(null);
      if (finalScore <= 0) return;
      try {
        await submit.mutateAsync({ game: gameId, score: finalScore });
      } catch {
        toast.error("Couldn't save that score");
      }
      try {
        const result = await awardArcadeXp(gameId, finalScore);
        setReward(result);
        if (result.status === "awarded" || result.status === "granted") {
          syncXp(result, "arcade run");
          toast.success(
            `+${result.gained} XP · +${result.sparks_gained} sparks` +
              (result.personal_best ? " · new personal best bonus" : "") +
              (surgeActive ? " · surge doubled" : ""),
          );
          refresh();
        } else if (result.status === "capped") {
          toast("Score saved. You've maxed today's arcade XP — the leaderboard still counts.");
        } else if (result.status === "cooldown") {
          toast("Score saved. XP again in under a minute.");
        }
      } catch {
        toast.error("Score saved, but XP didn't land");
      }
    },
    [gameId, refresh, submit, surgeActive, syncXp],
  );

  const endRef = useRef(end);
  endRef.current = end;
  const handleEnd = useCallback((s: number) => void endRef.current(s), []);
  const handleScore = useCallback((s: number) => setScore(s), []);

  const playing = phase === "playing";

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <PanelHead
          eyebrow="Mastery"
          title={`${totalRanks} ranks earned`}
          aside={`${mastery.filter((m) => totalRanks >= (UNLOCK_AT[m.game.id] ?? 0)).length}/${GAMES.length} games unlocked`}
        />
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Beating your own high score raises that game's rank: Rookie → Runner → Adept → Veteran → Ace →
          Nova. Total ranks unlock the harder games. Games are listed richest XP first — payouts are balanced against a good run in each game, so longer, harder games pay a little more.
        </p>
      </Panel>

      {/* Game picker */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mastery.map((m, i) => {
          const g = m.game;
          const selected = g.id === gameId;
          const need = UNLOCK_AT[g.id] ?? 0;
          const isLocked = totalRanks < need;
          return (
            <button
              key={g.id}
              disabled={isLocked}
              onClick={() => {
                setGameId(g.id);
                setPhase("idle");
                setScore(0);
              }}
              className={cn(
                "glass animate-rise rounded-2xl p-4 text-left transition-colors",
                selected && !isLocked ? "ring-primary/60 ring-2" : "",
                isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-secondary/40",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight">{g.name}</h3>
                {isLocked ? (
                  <Lock className="text-muted-foreground size-3.5 shrink-0" />
                ) : (
                  <span className="text-gold shrink-0 font-mono text-[10px]">
                    {parXp(g)} XP
                  </span>
                )}
              </div>
              {isLocked ? (
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  Unlocks at {need} mastery ranks.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{g.tagline}</p>
                  <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                    best {m.best.toLocaleString()} · #{i + 1} XP payout
                  </p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className={m.rank >= 5 ? "text-gold" : "text-primary"}>{m.name}</span>
                      <span className="text-muted-foreground">
                        {m.next ? `${m.next.toLocaleString()} to rank up` : "maxed"}
                      </span>
                    </div>
                    <div className="bg-secondary/50 mt-1 h-1 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.round(m.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="relative flex flex-col items-center gap-4 p-5">
          <div className="flex w-full items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Now playing</p>
              <h2 className="font-display mt-1 text-lg font-semibold tracking-tight">{game.name}</h2>
              <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                {game.controls} · {current.name}
              </p>
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
                  <NovaBlocks running onScore={handleScore} onEnd={handleEnd} />
                ) : gameId === "aurora-drift" ? (
                  <AuroraDrift running onScore={handleScore} onEnd={handleEnd} />
                ) : gameId === "prism-break" ? (
                  <PrismBreak running onScore={handleScore} onEnd={handleEnd} />
                ) : gameId === "comet-sling" ? (
                  <CometSling running onScore={handleScore} onEnd={handleEnd} />
                ) : gameId === "nova-fusion" ? (
                  <NovaFusion running onScore={handleScore} onEnd={handleEnd} />
                ) : gameId === "tower-stack" ? (
                  <TowerStack running onScore={handleScore} onEnd={handleEnd} />
                ) : gameId === "lane-hop" ? (
                  <LaneHop running onScore={handleScore} onEnd={handleEnd} />
                ) : (
                  <NeonCoil running onScore={handleScore} onEnd={handleEnd} />
                )}
              </div>
            ) : (
              <div className="border-border bg-background/40 flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6 text-center">
                {gameLocked ? (
                  <>
                    <p className="eyebrow">Locked</p>
                    <p className="text-muted-foreground max-w-sm text-sm">
                      Earn {UNLOCK_AT[gameId]} mastery ranks to unlock {game.name}.
                    </p>
                  </>
                ) : phase === "over" ? (
                  <>
                    <p className="eyebrow">{isNewBest ? "New personal best" : "Run over"}</p>
                    <p className="numeral text-5xl">{Math.round(score).toLocaleString()}</p>
                    <p className="text-muted-foreground text-sm">
                      Your best is {Math.max(best, Math.round(score)).toLocaleString()} · rank{" "}
                      {current.name}.
                    </p>
                    {reward?.status === "granted" ? (
                      <div className="border-border/70 bg-secondary/40 rounded-xl border px-4 py-2.5">
                        <p className="font-mono text-[11px] tracking-wide">
                          <span className="text-primary">+{reward.gained} XP</span>
                          <span className="text-muted-foreground"> · </span>
                          <span className="text-gold">+{reward.sparks_gained} sparks</span>
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          {reward.personal_best ? "Personal-best bonus included. " : ""}
                          {reward.runs_left != null && reward.runs_left <= 5
                            ? `${reward.runs_left} paid runs left today.`
                            : "Higher scores pay more XP."}
                        </p>
                      </div>
                    ) : reward?.status === "capped" ? (
                      <p className="text-muted-foreground text-[11px]">
                        Daily XP maxed — scores still count on the leaderboard.
                      </p>
                    ) : null}
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
                        your best · {best.toLocaleString()} · rank {current.name}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        </Panel>

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

      <TopPlayersPanel meId={profile?.id} />
    </div>
  );
}

// ------------------------------------------------------------- Top players

function TopPlayersPanel({ meId }: { meId: string | undefined }) {
  const top = useTopGamePlayers(15);
  return (
    <Panel className="p-5">
      <PanelHead
        eyebrow="Hall of fame"
        title="Top players"
        aside={<span className="text-muted-foreground font-mono text-[11px]">XP from games</span>}
      />
      {top.isLoading ? (
        <p className="text-muted-foreground mt-4 font-mono text-[11px]">Loading…</p>
      ) : (top.data ?? []).length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No game XP earned yet. Play a run and take the top spot.
        </p>
      ) : (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(top.data ?? []).map((row, i) => (
            <li
              key={row.user_id}
              className={cn(
                "border-border bg-background/40 flex items-center gap-2 rounded-xl border px-2.5 py-2",
                row.user_id === meId && "border-primary/40",
              )}
            >
              <span
                className={cn(
                  "numeral w-5 shrink-0 text-sm",
                  i === 0 ? "text-gold" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <IdentityRow
                  profile={{
                    username: row.username,
                    display_name: row.display_name,
                    avatar_url: row.avatar_url,
                    equipped_nametag: row.equipped_nametag,
                    equipped_badge: row.equipped_badge,
                    equipped_frame: row.equipped_frame,
                  }}
                  size={26}
                />
              </div>
              <span className="shrink-0 text-right">
                <span className="numeral block text-sm">{row.arcade_xp.toLocaleString()}</span>
                <span className="text-muted-foreground block font-mono text-[10px]">
                  {row.runs} runs
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
