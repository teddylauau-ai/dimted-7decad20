import { useEffect } from "react";
import { useDimted } from "@/lib/dimted-store";
import { RarityChip } from "./primitives";
import { Button } from "@/components/ui/button";
import { nextUnlock, rankForLevel } from "@/lib/dimted";
import partyPig from "@/assets/party-pig.png";

const SPARKS = [
  { left: "18%", delay: "0ms", size: "size-1.5", x: "-14px" },
  { left: "32%", delay: "180ms", size: "size-1", x: "10px" },
  { left: "47%", delay: "60ms", size: "size-2", x: "-6px" },
  { left: "58%", delay: "320ms", size: "size-1", x: "18px" },
  { left: "71%", delay: "140ms", size: "size-1.5", x: "-20px" },
  { left: "84%", delay: "260ms", size: "size-1", x: "8px" },
];

const PIG_LINES = [
  "No new toys this level. The pig is proud anyway.",
  "Nothing unlocked — but this pig threw a party for you.",
  "Zero rewards. Maximum pig.",
  "The vault stayed shut, so here's a pig instead.",
];

/**
 * Level-up celebration. Auto-dismisses so progression never nags —
 * structure is sound-ready: one mount = one cue.
 */
export function LevelUpOverlay() {
  const { levelUp, dismissLevelUp } = useDimted();

  useEffect(() => {
    if (!levelUp) return;
    const t = window.setTimeout(dismissLevelUp, 9000);
    return () => window.clearTimeout(t);
  }, [levelUp, dismissLevelUp]);

  if (!levelUp) return null;

  const previousRank = rankForLevel(Math.max(1, levelUp.level - 1));
  const newRank = levelUp.rank !== previousRank;
  const upcoming = nextUnlock(levelUp.level);
  const pigLine = PIG_LINES[levelUp.level % PIG_LINES.length]!;

  return (
    <div
      className="bg-background/70 fixed inset-0 z-50 grid place-items-center p-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SPARKS.map((s) => (
          <span
            key={s.left}
            className={`bg-gold animate-spark absolute bottom-[38%] rounded-full ${s.size}`}
            style={{ left: s.left, animationDelay: s.delay, ["--spark-x" as string]: s.x }}
          />
        ))}
      </div>

      <div className="glass-raised glow-gold border-gold/30 animate-pop-in relative w-full max-w-sm rounded-3xl border p-8 text-center">
        <p className="text-gold font-mono text-[11px] tracking-[0.34em] uppercase">Level up</p>
        <p className="numeral text-glow mt-3 text-6xl leading-none">{levelUp.level}</p>
        <p className="text-muted-foreground mt-2 font-mono text-xs">
          {levelUp.rank}
          {levelUp.gained ? ` · +${levelUp.gained} XP` : ""}
        </p>

        <p className="eyebrow mt-6 text-left">What you get</p>

        <div className="mt-2 space-y-2 text-left">
          {newRank ? (
            <div className="border-gold/25 bg-gold/[0.06] rounded-2xl border p-3">
              <p className="font-display text-sm font-semibold">New rank: {levelUp.rank}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Shown beside your name everywhere on Lumo.
              </p>
            </div>
          ) : null}

          {levelUp.unlock ? (
            <div className="border-border bg-background/40 rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-sm font-semibold">{levelUp.unlock.name}</p>
                <RarityChip rarity={levelUp.unlock.rarity} />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{levelUp.unlock.detail}</p>
            </div>
          ) : null}

          {!levelUp.unlock && !newRank ? (
            <div className="border-border bg-background/40 rounded-2xl border p-3 text-center">
              <img
                src={partyPig}
                alt="Cartoon party pig celebrating your level up"
                loading="lazy"
                width={768}
                height={768}
                className="animate-pop-in mx-auto size-28 object-contain drop-shadow-lg"
              />
              <p className="font-display mt-1 text-sm font-semibold">Level {levelUp.level}!</p>
              <p className="text-muted-foreground mt-1 text-xs">{pigLine}</p>
            </div>
          ) : null}

          <div className="border-border/70 bg-background/30 rounded-2xl border border-dashed p-3">
            <p className="text-muted-foreground text-xs">
              {upcoming
                ? `Next up at level ${upcoming.level}: ${upcoming.name}`
                : "You've unlocked everything on the ladder. Absolute unit."}
            </p>
          </div>
        </div>

        <Button onClick={dismissLevelUp} className="mt-6 w-full">
          Keep going
        </Button>
      </div>
    </div>
  );
}
