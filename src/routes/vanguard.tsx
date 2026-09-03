import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Check, Lock, Play, Star, Swords, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { NovaVanguard, type VanguardRunEnd } from "@/components/games/NovaVanguard";
import {
  GEAR,
  LEVELS,
  WEAPONS,
  coresFor,
  gearBySlug,
  runScore,
  scoreRun,
  weaponBySlug,
  type GearSlug,
  type LevelDef,
} from "@/lib/vanguard";
import {
  bestMsForLevel,
  highestVanguardCleared,
  starsForLevel,
  useEquipLoadout,
  useFinishLevel,
  useUnlockItem,
  useVanguardProgress,
  useVanguardState,
  useVanguardUnlocks,
  vanguardStars,
} from "@/lib/vanguard-queries";
import { awardArcadeXp, type ArcadeReward } from "@/lib/games-queries";
import { useDimted } from "@/lib/dimted-store";
import { useRefreshDimted } from "@/lib/dimted-queries";
import { cn } from "@/lib/utils";
import type { GameId } from "@/lib/games";

export const Route = createFileRoute("/vanguard")({
  head: () => ({
    meta: [
      { title: "Nova Vanguard — 12-level action platformer | Dimted" },
      {
        name: "description",
        content:
          "Nova Vanguard is Dimted's flagship game: twelve hand-built combat levels, five unlockable weapons, five gear modules, three bosses and star ratings on every run.",
      },
      { property: "og:title", content: "Nova Vanguard — Dimted" },
      {
        property: "og:description",
        content:
          "Run, dash and shoot through twelve levels. Earn cores, unlock weapons and gear, and beat three bosses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VanguardPage,
});

type Phase = "select" | "playing" | "result";

function VanguardPage() {
  const { profile } = useDimted();
  const state = useVanguardState(profile?.id);
  const unlocks = useVanguardUnlocks(profile?.id);
  const progress = useVanguardProgress(profile?.id);
  const finish = useFinishLevel(profile?.id);
  const unlock = useUnlockItem(profile?.id);
  const equip = useEquipLoadout(profile?.id);
  const refresh = useRefreshDimted();

  const [phase, setPhase] = useState<Phase>("select");
  const [level, setLevel] = useState<LevelDef>(LEVELS[0]!);
  const [tab, setTab] = useState<"levels" | "armory">("levels");
  const [result, setResult] = useState<
    (VanguardRunEnd & { stars: number; coresEarned: number; reward?: ArcadeReward }) | null
  >(null);

  const cores = state.data?.cores ?? 0;
  const owned = useMemo(() => new Set(unlocks.data ?? []), [unlocks.data]);
  const weapon = weaponBySlug(state.data?.equipped_weapon ?? "pulse-rifle");
  const gear = (state.data?.equipped_gear ?? null) as GearSlug | null;
  const cleared = highestVanguardCleared(progress.data);
  const stars = vanguardStars(progress.data);

  const start = (l: LevelDef) => {
    setLevel(l);
    setResult(null);
    setPhase("playing");
  };

  const onEnd = useCallback(
    async (run: VanguardRunEnd) => {
      const scored = run.cleared
        ? scoreRun(level, run.ms, run.damageTaken)
        : { stars: 0, noDamage: false, underPar: false };
      const earned = run.cleared
        ? coresFor(level, run.kills, run.coresCollected, scored.stars)
        : Math.min(60, run.kills * 3 + run.coresCollected * 4);
      setResult({ ...run, stars: scored.stars, coresEarned: earned });
      setPhase("result");

      try {
        if (run.cleared) {
          await finish.mutateAsync({
            level: level.n,
            ms: run.ms,
            stars: scored.stars,
            cores: earned,
          });
          const reward = await awardArcadeXp(
            "nova-vanguard" as GameId,
            runScore(level, scored.stars, run.kills, run.ms),
          );
          setResult((r) => (r ? { ...r, reward } : r));
          if (reward.status === "granted") {
            toast.success(`+${reward.gained} XP · +${reward.sparks_gained} sparks`);
          }
          refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save that run");
      }
    },
    [level, finish, refresh],
  );

  if (!profile) return null;

  if (phase === "playing") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">
              Level {level.n} · {weapon.name}
              {gear ? ` · ${gearBySlug(gear)?.name}` : ""}
            </p>
            <h1 className="font-display text-xl font-semibold tracking-tight">{level.name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPhase("select")}>
            Abandon
          </Button>
        </div>
        <NovaVanguard level={level} weapon={weapon} gear={gear} onEnd={(r) => void onEnd(r)} />
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="space-y-4">
        <Panel className="p-6 text-center">
          <p className="eyebrow">{result.cleared ? "Extraction complete" : "Run failed"}</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
            {level.n}. {level.name}
          </h1>
          <div className="mt-3 flex justify-center gap-1">
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                className={cn(
                  "size-6",
                  i <= result.stars ? "text-gold fill-current" : "text-muted-foreground/25",
                )}
              />
            ))}
          </div>
          <div className="text-muted-foreground mt-4 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <Stat label="Time" value={`${(result.ms / 1000).toFixed(1)}s`} />
            <Stat label="Kills" value={String(result.kills)} />
            <Stat label="Cores" value={`+${result.coresEarned}`} />
            <Stat label="Damage" value={String(result.damageTaken)} />
          </div>
          {result.cleared ? (
            <p className="text-muted-foreground mt-3 font-mono text-[11px]">
              {result.damageTaken === 0 ? "Flawless ✓ " : "Take no damage for a second star. "}
              {result.ms <= level.parMs
                ? "Under par ✓"
                : `Par is ${(level.parMs / 1000).toFixed(0)}s for the speed star.`}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => start(level)}>Retry</Button>
            {result.cleared && LEVELS[level.n] ? (
              <Button variant="outline" onClick={() => start(LEVELS[level.n]!)}>
                Next level
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setPhase("select")}>
              Back to base
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
        title="Nova Vanguard"
        blurb="Twelve hand-built combat levels. Shoot, dash and jump your way to the extraction gate, bank cores, then spend them on weapons and gear that change how you play."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass-raised inline-flex rounded-full p-1">
          {(
            [
              { id: "levels", label: "Campaign" },
              { id: "armory", label: "Armory" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs transition-colors",
                tab === t.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-muted-foreground flex items-center gap-4 font-mono text-[11px]">
          <span className="text-gold">✦ {cores} cores</span>
          <span>
            {stars}/{LEVELS.length * 3} stars
          </span>
          <span className="text-primary">{weapon.name}</span>
        </div>
      </div>

      {tab === "levels" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {LEVELS.map((l) => {
            const locked = l.n > cleared + 1;
            const got = starsForLevel(progress.data, l.n);
            const best = bestMsForLevel(progress.data, l.n);
            return (
              <Panel key={l.n} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      Level {l.n}
                      {l.boss ? " · Boss" : ""}
                    </p>
                    <h3 className="font-display truncate text-base font-semibold">{l.name}</h3>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3.5",
                          i <= got ? "text-gold fill-current" : "text-muted-foreground/25",
                        )}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">{l.brief}</p>
                <div className="text-muted-foreground flex items-center justify-between font-mono text-[10px]">
                  <span>par {(l.parMs / 1000).toFixed(0)}s</span>
                  <span>{best ? `best ${(best / 1000).toFixed(1)}s` : "no clear yet"}</span>
                </div>
                {locked ? (
                  <Button variant="outline" disabled className="w-full">
                    <Lock className="mr-1.5 size-3.5" /> Clear level {l.n - 1}
                  </Button>
                ) : (
                  <Button onClick={() => start(l)} className="w-full">
                    <Play className="mr-1.5 size-3.5" /> {got > 0 ? "Replay" : "Deploy"}
                  </Button>
                )}
              </Panel>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          <Panel className="p-4">
            <PanelHead
              eyebrow="Loadout"
              title="Equipped"
              aside={`✦ ${cores} cores available`}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="glass-raised rounded-xl p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase">
                  <Swords className="size-3.5" /> Weapon
                </p>
                <p className="mt-1 text-sm font-semibold">{weapon.name}</p>
                <p className="text-muted-foreground text-xs">{weapon.blurb}</p>
              </div>
              <div className="glass-raised rounded-xl p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase">
                  <Shield className="size-3.5" /> Gear
                </p>
                <p className="mt-1 text-sm font-semibold">{gearBySlug(gear)?.name ?? "None"}</p>
                <p className="text-muted-foreground text-xs">
                  {gearBySlug(gear)?.blurb ?? "Pick a module below for a second ability."}
                </p>
              </div>
            </div>
          </Panel>

          <div>
            <PanelHead eyebrow="Arsenal" title="Weapons" className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {WEAPONS.map((w) => {
                const has = w.price === 0 || owned.has(w.slug);
                const equipped = weapon.slug === w.slug;
                return (
                  <Panel key={w.slug} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-sm font-semibold">{w.name}</h4>
                      <span className="text-gold font-mono text-[10px]">
                        {w.price === 0 ? "Standard" : `✦ ${w.price}`}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{w.blurb}</p>
                    <p className="text-muted-foreground/80 font-mono text-[10px]">
                      {w.damage} dmg · {(1000 / w.cooldown).toFixed(1)}/s
                      {w.pellets > 1 ? ` · ×${w.pellets}` : ""}
                      {w.pierce ? " · pierce" : ""}
                      {w.homing ? " · homing" : ""}
                      {w.splash ? " · splash" : ""}
                    </p>
                    {equipped ? (
                      <Button variant="outline" disabled className="w-full">
                        <Check className="mr-1.5 size-3.5" /> Equipped
                      </Button>
                    ) : has ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          void equip
                            .mutateAsync({ weapon: w.slug, gear })
                            .then(() => toast.success(`${w.name} equipped`))
                            .catch(() => toast.error("Couldn't equip that"))
                        }
                      >
                        Equip
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={cores < w.price || unlock.isPending}
                        onClick={() => void buy(w.slug, w.name)}
                      >
                        Unlock · ✦ {w.price}
                      </Button>
                    )}
                  </Panel>
                );
              })}
            </div>
          </div>

          <div>
            <PanelHead eyebrow="Modules" title="Gear" className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {GEAR.map((it) => {
                const has = owned.has(it.slug);
                const equipped = gear === it.slug;
                return (
                  <Panel key={it.slug} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display flex items-center gap-1.5 text-sm font-semibold">
                        <Zap className="text-primary size-3.5" /> {it.name}
                      </h4>
                      <span className="text-gold font-mono text-[10px]">✦ {it.price}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">{it.blurb}</p>
                    {has ? (
                      <Button
                        variant={equipped ? "outline" : "default"}
                        className="w-full"
                        onClick={() =>
                          void equip
                            .mutateAsync({
                              weapon: weapon.slug,
                              gear: equipped ? null : (it.slug as string),
                            })
                            .then(() => toast.success(equipped ? "Module removed" : `${it.name} equipped`))
                            .catch(() => toast.error("Couldn't equip that"))
                        }
                      >
                        {equipped ? "Unequip" : "Equip"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={cores < it.price || unlock.isPending}
                        onClick={() => void buy(it.slug, it.name)}
                      >
                        Unlock · ✦ {it.price}
                      </Button>
                    )}
                  </Panel>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  async function buy(slug: string, name: string) {
    try {
      const res = await unlock.mutateAsync(slug);
      if (res.status === "unlocked") toast.success(`${name} unlocked`);
      else if (res.status === "owned") toast.info("You already own that");
      else if (res.status === "insufficient") toast.error("Not enough cores — clear more levels");
      else toast.error("Couldn't unlock that");
    } catch {
      toast.error("Couldn't unlock that");
    }
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-raised rounded-xl px-3 py-2">
      <p className="text-muted-foreground/70 text-[10px] tracking-[0.16em] uppercase">{label}</p>
      <p className="text-foreground numeral mt-0.5 text-sm">{value}</p>
    </div>
  );
}
