import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, Coins, Crown, Flame, Infinity as InfinityIcon, Lock, Play, Repeat, Shapes, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { PulseSkinPreview } from "@/components/games/PulseSkinPreview";
import { PulseRush, type PulseRunEnd, type PulseSkins } from "@/components/games/PulseRush";
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_TONE,
  KIND_LABEL,
  LEVELS,
  buildLevel,
  coinBits,
  colorPair,
  dailyEndlessSeed,
  dailyLevelN,
  endlessLevel,
  featText,
  isLevelUnlocked,
  runScore,
  type ItemKind,
  type LevelDef,
} from "@/lib/pulse";
import {
  clearedLevels,
  recordEndlessRun,
  rowFor,
  totalCoins,
  usePulseDailyClaim,
  usePulseDailyLeaderboard,
  usePulseDailyStreak,
  usePulseEndlessBest,
  usePulseEquip,
  usePulseFinish,
  usePulseItems,
  usePulseProgress,
  usePulseState,
  usePulseUnlock,
  usePulseUnlocks,
  usePulseLeaderboard,
} from "@/lib/pulse-queries";
import { awardArcadeXp, type ArcadeReward } from "@/lib/games-queries";
import { IdentityRow } from "@/components/dimted/Identity";
import { useDimted } from "@/lib/dimted-store";
import { useRefreshDimted } from "@/lib/dimted-queries";
import { cn } from "@/lib/utils";
import type { GameId } from "@/lib/games";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "Pulse Rush — one-button rhythm platformer | Lazu" },
      {
        name: "description",
        content:
          "Pulse Rush is Lazu's flagship game: 27 hand-built rhythm levels, an endless mode, a daily challenge, ship, wave and ball modes, secret coins, and a locker full of unlockable cubes, trails and death effects.",
      },
      { property: "og:title", content: "Pulse Rush — Lazu" },
      {
        property: "og:description",
        content:
          "One tap. Twenty-seven levels plus an endless run. Memorise the beat, clear the run, collect the coins and unlock everything.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PulsePage,
});

type Phase = "select" | "playing" | "result";

const KIND_ORDER: ItemKind[] = ["icon", "ship", "ball", "wave", "trail", "death", "colors"];

function PulsePage() {
  const { profile, syncXp } = useDimted();
  const state = usePulseState(profile?.id);
  const items = usePulseItems();
  const progress = usePulseProgress(profile?.id);
  const ownedItems = usePulseUnlocks(profile?.id);
  const finish = usePulseFinish(profile?.id);
  const unlock = usePulseUnlock(profile?.id);
  const equip = usePulseEquip(profile?.id);
  const board = usePulseLeaderboard();
  const refresh = useRefreshDimted();

  const [phase, setPhase] = useState<Phase>("select");
  const [tab, setTab] = useState<"levels" | "locker" | "ranks">("levels");
  const [lockerKind, setLockerKind] = useState<ItemKind>("icon");
  const [level, setLevel] = useState<LevelDef>(LEVELS[0]!);
  const [practice, setPractice] = useState(false);
  const [result, setResult] = useState<(PulseRunEnd & { reward?: ArcadeReward }) | null>(null);
  const quitRef = useRef<() => void>(() => {});

  const coins = state.data?.coins ?? 0;
  const cleared = useMemo(() => clearedLevels(progress.data), [progress.data]);
  const collected = totalCoins(progress.data);
  const owned = useMemo(() => new Set(ownedItems.data ?? []), [ownedItems.data]);
  const dailyN = useMemo(() => dailyLevelN(cleared), [cleared]);
  const dailyClaimed = usePulseDailyClaim(profile?.id);
  const dailyLevel = LEVELS[dailyN - 1] ?? LEVELS[0]!;
  const endlessDef = useMemo(() => endlessLevel(dailyEndlessSeed()), []);
  const endlessBest = usePulseEndlessBest(profile?.id);
  const dailyBoard = usePulseDailyLeaderboard();
  const streak = usePulseDailyStreak(profile?.id);
  const [endless, setEndless] = useState(false);

  const skins: PulseSkins = {
    icon: state.data?.equipped_icon ?? "cube-origin",
    ship: state.data?.equipped_ship ?? "ship-standard",
    ball: state.data?.equipped_ball ?? "ball-standard",
    wave: state.data?.equipped_wave ?? "wave-standard",
    trail: state.data?.equipped_trail ?? "trail-plasma",
    death: state.data?.equipped_death ?? "death-shatter",
    colors: state.data?.equipped_colors ?? "col-aurora",
  };

  const start = (l: LevelDef, prac: boolean, isEndless = false) => {
    setLevel(l);
    setPractice(prac);
    setEndless(isEndless);
    setResult(null);
    setPhase("playing");
  };

  const onEnd = useCallback(
    async (run: PulseRunEnd) => {
      setResult(run);
      setPhase("result");
      try {
        if (endless) {
          // Infinite Run: distance is the score, XP scales with how far you got.
          const units = Math.round((run.pct / 100) * buildLevel(level).length);
          if (units > 0 && profile) {
            await recordEndlessRun(profile.id, units);
            const reward = await awardArcadeXp("pulse-rush" as GameId, Math.min(units, 20000));
            setResult((r) => (r ? { ...r, reward } : r));
            if (reward.status === "granted" || reward.status === "awarded") {
              syncXp(reward, "Pulse Rush · Infinite Run");
              toast.success(`+${reward.gained} XP · +${reward.sparks_gained} sparks`);
            }
            refresh();
          }
          return;
        }
        const res = await finish.mutateAsync({
          level: level.n,
          pct: run.pct,
          ms: run.ms,
          coinMask: run.coinMask,
          practice,
          daily: level.n === dailyN,
        });
        if (practice) return;
        if (res.gained) toast.success(`+${res.gained} coins`);
        if (res.daily_bonus) toast.success(`Daily challenge bonus: +${res.daily_bonus} coins`);
        // Every real run earns XP — a 72% attempt still counts toward your level.
        const reward = await awardArcadeXp(
          "pulse-rush" as GameId,
          runScore(level.n, run.pct, coinBits(run.coinMask).filter(Boolean).length),
        );
        setResult((r) => (r ? { ...r, reward } : r));
        if (reward.status === "granted" || reward.status === "awarded") {
          syncXp(reward, `Pulse Rush level ${level.n}`);
          toast.success(`+${reward.gained} XP · +${reward.sparks_gained} sparks`);
        }
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save that attempt");
      }
    },
    [level, practice, endless, profile, finish, refresh, syncXp, dailyN],
  );

  if (!profile) return null;

  if (phase === "playing") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">
              {endless ? "Infinite Run · today's mountain" : `Level ${level.n} · ${DIFFICULTY_LABEL[level.difficulty]}`}
              {practice ? " · practice" : ""}
            </p>
            <h1 className="font-display text-xl font-semibold tracking-tight">{level.name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => quitRef.current()}>
            End run
          </Button>
        </div>
        <PulseRush
          level={level}
          skins={skins}
          practice={practice}
          quitRef={quitRef}
          onEnd={(r) => void onEnd(r)}
        />
      </div>
    );
  }

  if (phase === "result" && result) {
    const got = coinBits(result.coinMask);
    return (
      <div className="space-y-4">
        <Panel className="p-6 text-center">
          <p className="eyebrow">{result.cleared && !endless ? "Level complete" : "Run ended"}</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
            {endless ? "Infinite Run" : `${level.n}. ${level.name}`}
          </h1>
          <p className="font-display text-primary mt-3 text-5xl font-semibold tabular-nums">
            {endless
              ? `${Math.round((result.pct / 100) * buildLevel(level).length)}u`
              : `${Math.floor(result.pct)}%`}
          </p>
          {endless ? (
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              personal best {endlessBest.data ?? 0}u
            </p>
          ) : null}
          <div className="mt-3 flex justify-center gap-2">
            {got.map((g, i) => (
              <Coins
                key={i}
                className={cn("size-5", g ? "text-gold" : "text-muted-foreground/25")}
              />
            ))}
          </div>
          <div className="text-muted-foreground mt-4 flex justify-center gap-6 font-mono text-xs">
            <span>attempts {result.attempts}</span>
            <span>{(result.ms / 1000).toFixed(1)}s</span>
            {practice ? <span>practice — no rewards</span> : null}
          </div>
          {!practice && result.reward?.gained ? (
            <div className="border-primary/30 bg-primary/5 mt-4 inline-flex items-center gap-4 rounded-full border px-5 py-2 font-mono text-sm">
              <span className="text-primary font-semibold">+{result.reward.gained} XP</span>
              <span className="text-gold font-semibold">+{result.reward.sparks_gained} sparks</span>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => start(level, practice, endless)}>
              <Repeat className="mr-1 size-4" /> Again
            </Button>
            {!endless && result.cleared && LEVELS[level.n] ? (
              <Button variant="outline" onClick={() => start(LEVELS[level.n]!, false)}>
                Next level
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setPhase("select")}>
              Level select
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Flagship"
        title="Pulse Rush"
        blurb="One button. Twenty-seven levels and an endless mountain. Memorise the beat, clear the run, take the coins."
        aside={
          <div className="flex items-center gap-3">
            <span className="text-gold flex items-center gap-1.5 font-mono text-sm">
              <Coins className="size-4" /> {coins}
            </span>
            <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-sm">
              <Trophy className="size-4" /> {cleared.length}/{LEVELS.length}
            </span>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="border-primary/25 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="bg-primary/15 text-primary grid size-9 place-items-center rounded-xl">
              <CalendarClock className="size-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">
                Daily challenge · Level {dailyLevel.n} — {dailyLevel.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {dailyClaimed.data
                  ? "Bonus claimed — come back tomorrow for a new level."
                  : "Clear it today for a one-time +50 coin bonus. Resets at UTC midnight."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(streak.data ?? 0) > 0 ? (
              <span className="text-gold flex items-center gap-1 font-mono text-xs" title="Daily streak">
                <Flame className="size-3.5" /> {streak.data}d
              </span>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => start(dailyLevel, false)}>
              <Play className="size-3.5" /> {dailyClaimed.data ? "Replay" : "Play the daily"}
            </Button>
          </div>
        </Panel>

        <Panel className="border-fuchsia-400/25 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-fuchsia-400/15 text-fuchsia-300">
              <InfinityIcon className="size-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">Infinite Run</p>
              <p className="text-muted-foreground text-xs">
                No finish line — today's mountain is the same for everyone. Best:{" "}
                <span className="text-foreground font-mono">{endlessBest.data ?? 0}u</span>
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => start(endlessDef, false, true)}>
            <Play className="size-3.5" /> Run it
          </Button>
        </Panel>
      </div>

      <div className="flex gap-2">
        {(["levels", "locker", "ranks"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm capitalize transition",
              tab === t
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "levels" ? "Levels" : t === "locker" ? "Locker" : "Leaderboard"}
          </button>
        ))}
      </div>

      {tab === "ranks" ? (
        <div className="space-y-4">
        <Panel className="p-4">
          <PanelHead
            eyebrow="Today"
            title="Daily challenge board"
            aside={
              <span className="text-muted-foreground font-mono text-xs">
                best score today · resets UTC midnight
              </span>
            }
          />
          {(dailyBoard.data ?? []).length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nobody has run the daily yet. First clear takes the crown.
            </p>
          ) : (
            <ol className="mt-3 divide-y divide-white/5">
              {(dailyBoard.data ?? []).map((r, i) => (
                <li
                  key={r.user_id}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    r.user_id === profile.id && "bg-primary/5 -mx-2 rounded-lg px-2",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 shrink-0 text-center font-mono text-sm",
                      i === 0 ? "text-gold" : "text-muted-foreground",
                    )}
                  >
                    {i === 0 ? <Crown className="mx-auto size-4" /> : i + 1}
                  </span>
                  <IdentityRow profile={r.profile} className="flex-1" />
                  <span className="text-foreground shrink-0 font-mono text-xs">{r.score}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel className="p-4">
          <PanelHead
            eyebrow="Global"
            title="Pulse Rush leaderboard"
            aside={
              <span className="text-muted-foreground font-mono text-xs">
                ranked by clears, then secret coins
              </span>
            }
          />
          {board.isLoading ? (
            <p className="text-muted-foreground mt-4 text-sm">Loading runs…</p>
          ) : (board.data ?? []).length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nobody has cleared a level yet. Be the first name up here.
            </p>
          ) : (
            <ol className="mt-3 divide-y divide-white/5">
              {(board.data ?? []).map((r, i) => (
                <li
                  key={r.user_id}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    r.user_id === profile.id && "bg-primary/5 -mx-2 rounded-lg px-2",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 shrink-0 text-center font-mono text-sm",
                      i === 0 ? "text-gold" : "text-muted-foreground",
                    )}
                  >
                    {i === 0 ? <Crown className="mx-auto size-4" /> : i + 1}
                  </span>
                  <IdentityRow
                    profile={r.profile}
                    className="flex-1"
                    meta={`${r.attempts} attempts`}
                  />
                  <span className="text-muted-foreground flex shrink-0 items-center gap-4 font-mono text-xs">
                    <span className="text-foreground">{r.clears}/{LEVELS.length}</span>
                    <span className="text-gold flex items-center gap-1">
                      <Coins className="size-3.5" /> {r.coins}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        </div>
      ) : tab === "levels" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {LEVELS.map((l) => {
            const row = rowFor(progress.data, l.n);
            const open = isLevelUnlocked(l.n, cleared);
            const bits = coinBits(row?.coins ?? 0);
            const done = (row?.best_pct ?? 0) >= 100;
            return (
              <Panel key={l.n} className={cn("p-4", !open && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">Level {l.n}</p>
                    <h2 className="font-display text-lg font-semibold tracking-tight">{l.name}</h2>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase",
                      DIFFICULTY_TONE[l.difficulty],
                    )}
                  >
                    {DIFFICULTY_LABEL[l.difficulty]}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{l.brief}</p>

                <div className="bg-secondary/60 relative mt-3 h-2 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      done ? "bg-gold" : "from-primary to-accent bg-gradient-to-r",
                    )}
                    style={{ width: `${row?.best_pct ?? 0}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-2 flex items-center justify-between font-mono text-[11px]">
                  <span>{row?.best_pct ?? 0}% best</span>
                  <span className="flex items-center gap-1">
                    {bits.map((g, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-2.5 w-2.5 rounded-full border",
                          g ? "border-amber-200 bg-amber-400" : "border-white/15 bg-white/5",
                        )}
                      />
                    ))}
                  </span>
                  <span>{row?.attempts ?? 0} att</span>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!open}
                    onClick={() => start(l, false)}
                  >
                    {open ? (
                      <>
                        {done ? <Check className="mr-1 size-4" /> : <Play className="mr-1 size-4" />}
                        {done ? "Replay" : "Play"}
                      </>
                    ) : (
                      <>
                        <Lock className="mr-1 size-4" /> Clear {l.n - 1}
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!open} onClick={() => start(l, true)}>
                    Practice
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <Panel className="p-4">
            <PanelHead
              eyebrow="Customise"
              title="Locker"
              aside={
                <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
                  <Shapes className="size-4" /> {coins} coins · {collected} secret found
                </span>
              }
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  onClick={() => setLockerKind(k)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    lockerKind === k
                      ? "border-primary/40 bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(items.data ?? [])
              .filter((it) => it.kind === lockerKind)
              .map((it) => {
                const free = it.price_coins === 0 && !it.feat && it.required_level <= 1;
                const isOwned = free || owned.has(it.slug);
                const equipped = equippedSlug(skins, it.kind) === it.slug;
                const pair = colorPair(it.slug);
                return (
                  <Panel key={it.slug} className={cn("p-4", equipped && "ring-primary/40 ring-1")}>
                    <div className="flex items-start gap-3">
                      <PulseSkinPreview kind={it.kind} slug={it.slug} colors={skins.colors} />
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold tracking-tight">{it.name}</h3>
                        <p className="text-muted-foreground mt-0.5 text-sm">{it.description}</p>
                        {it.kind === "colors" ? (
                          <span className="mt-1.5 flex gap-1">
                            <span
                              className="size-4 rounded-full border border-white/20"
                              style={{ background: pair.primary }}
                            />
                            <span
                              className="size-4 rounded-full border border-white/20"
                              style={{ background: pair.secondary }}
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-muted-foreground mt-2 font-mono text-[11px] uppercase">
                      {it.rarity}
                      {it.feat ? ` · needs ${featText(it.feat)}` : ""}
                      {it.required_level > 1 ? ` · level ${it.required_level}+` : ""}
                      {it.price_coins > 0 ? ` · ${it.price_coins} coins` : ""}
                    </p>

                    <div className="mt-3">
                      {equipped ? (
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          <Check className="mr-1 size-4" /> Equipped
                        </Button>
                      ) : isOwned ? (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            try {
                              await equip.mutateAsync({ slot: it.kind, slug: it.slug });
                            } catch {
                              toast.error("Couldn't equip that");
                            }
                          }}
                        >
                          Equip
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={async () => {
                            const res = await unlock.mutateAsync(it.slug);
                            if (res.status === "unlocked") toast.success(`${it.name} unlocked`);
                            else if (res.status === "insufficient")
                              toast.error(`Need ${res.price} coins — you have ${res.coins}`);
                            else if (res.status === "locked")
                              toast.error(`Reach level ${res.required_level} first`);
                            else if (res.status === "feat_locked")
                              toast.error(`Locked: ${res.have}/${res.need} — ${featText(it.feat!)}`);
                            else if (res.status === "owned") toast.message("Already yours");
                          }}
                        >
                          {it.feat || it.required_level > 1 ? (
                            <>
                              <Lock className="mr-1 size-4" /> Claim
                            </>
                          ) : (
                            <>
                              <Coins className="mr-1 size-4" /> {it.price_coins}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </Panel>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function equippedSlug(skins: PulseSkins, kind: ItemKind): string {
  return kind === "icon"
    ? skins.icon
    : kind === "ship"
      ? skins.ship
      : kind === "ball"
        ? skins.ball
        : kind === "wave"
          ? skins.wave
          : kind === "trail"
            ? skins.trail
            : kind === "death"
              ? skins.death
              : skins.colors;
}
