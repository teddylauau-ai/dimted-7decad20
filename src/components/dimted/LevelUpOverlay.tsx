import { useEffect } from "react";
import { useDimted } from "@/lib/dimted-store";
import { RarityChip } from "./primitives";
import { Button } from "@/components/ui/button";

const SPARKS = [
  { left: "18%", delay: "0ms", size: "size-1.5", x: "-14px" },
  { left: "32%", delay: "180ms", size: "size-1", x: "10px" },
  { left: "47%", delay: "60ms", size: "size-2", x: "-6px" },
  { left: "58%", delay: "320ms", size: "size-1", x: "18px" },
  { left: "71%", delay: "140ms", size: "size-1.5", x: "-20px" },
  { left: "84%", delay: "260ms", size: "size-1", x: "8px" },
];

/**
 * Level-up celebration. Auto-dismisses so progression never nags —
 * structure is sound-ready: one mount = one cue.
 */
export function LevelUpOverlay() {
  const { levelUp, dismissLevelUp } = useDimted();

  useEffect(() => {
    if (!levelUp) return;
    const t = window.setTimeout(dismissLevelUp, 6000);
    return () => window.clearTimeout(t);
  }, [levelUp, dismissLevelUp]);

  if (!levelUp) return null;

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
          {levelUp.rank} · +{levelUp.gained} XP
        </p>

        {levelUp.unlock ? (
          <div className="border-border bg-background/40 mt-6 rounded-2xl border p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">New unlock</p>
              <RarityChip rarity={levelUp.unlock.rarity} />
            </div>
            <p className="font-display mt-2 text-base font-semibold">{levelUp.unlock.name}</p>
            <p className="text-muted-foreground mt-1 text-xs">{levelUp.unlock.detail}</p>
          </div>
        ) : (
          <p className="text-muted-foreground mt-6 text-xs">
            Nothing unlocks at this level — but something is close.
          </p>
        )}

        <Button onClick={dismissLevelUp} className="mt-6 w-full">
          Keep going
        </Button>
      </div>
    </div>
  );
}
