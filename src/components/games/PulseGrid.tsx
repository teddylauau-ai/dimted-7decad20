import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Pulse Grid — pure reaction. A tile lights for a shrinking window; hit it to
 * build a multiplier, miss three and the run ends.
 */

const SIZE = 4;
const TILES = SIZE * SIZE;

export function PulseGrid({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const [miss, setMiss] = useState<number | null>(null);
  const [hud, setHud] = useState({ score: 0, combo: 1, misses: 0, window: 1200 });

  const score = useRef(0);
  const combo = useRef(1);
  const misses = useRef(0);
  const round = useRef(0);
  const timer = useRef<number | null>(null);
  const shownAt = useRef(0);
  const dead = useRef(false);

  const sync = useCallback((windowMs: number) => {
    setHud({ score: score.current, combo: combo.current, misses: misses.current, window: windowMs });
  }, []);

  const nextRound = useCallback(() => {
    if (dead.current) return;
    round.current += 1;
    const windowMs = Math.max(420, 1250 - round.current * 26);
    const tile = Math.floor(Math.random() * TILES);
    setActive(tile);
    shownAt.current = performance.now();
    sync(windowMs);

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // Missed the window.
      setActive(null);
      setMiss(tile);
      window.setTimeout(() => setMiss(null), 220);
      combo.current = 1;
      misses.current += 1;
      sync(windowMs);
      if (misses.current >= 3) {
        dead.current = true;
        onEnd(score.current);
        return;
      }
      window.setTimeout(nextRound, 340);
    }, windowMs);
  }, [onEnd, sync]);

  useEffect(() => {
    if (!running) return;
    score.current = 0;
    combo.current = 1;
    misses.current = 0;
    round.current = 0;
    dead.current = false;
    setActive(null);
    onScore(0);
    const start = window.setTimeout(nextRound, 600);
    return () => {
      window.clearTimeout(start);
      if (timer.current) window.clearTimeout(timer.current);
      dead.current = true;
    };
  }, [running, nextRound, onScore]);

  function tap(index: number) {
    if (!running || dead.current) return;
    if (index !== active) {
      // Wrong tile: costs the combo, not a life.
      combo.current = 1;
      setMiss(index);
      window.setTimeout(() => setMiss(null), 180);
      sync(hud.window);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    const reaction = performance.now() - shownAt.current;
    const speedBonus = Math.max(10, Math.round((hud.window - reaction) / 4));
    combo.current = Math.min(10, combo.current + 1);
    score.current += (50 + speedBonus) * combo.current;
    onScore(score.current);
    setActive(null);
    setHit(index);
    window.setTimeout(() => setHit(null), 160);
    sync(hud.window);
    window.setTimeout(nextRound, 200);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[340px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{hud.score.toLocaleString()}</span>
        <span className="text-gold">×{hud.combo}</span>
        <span>{"♥".repeat(Math.max(0, 3 - hud.misses)) || "—"}</span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, width: "min(340px, 86vw)" }}
      >
        {Array.from({ length: TILES }, (_, i) => (
          <button
            key={i}
            onPointerDown={() => tap(i)}
            className={cn(
              "aspect-square rounded-xl border transition-[background-color,box-shadow,transform] duration-100",
              i === active
                ? "border-primary bg-primary/80 shadow-[0_0_28px_-4px_var(--color-primary)] scale-[1.03]"
                : "border-border bg-secondary/40 hover:bg-secondary/70",
              i === hit && "border-gold bg-gold/70 shadow-[0_0_28px_-4px_var(--color-gold)]",
              i === miss && "border-destructive/70 bg-destructive/40",
            )}
            aria-label={`Tile ${i + 1}`}
          />
        ))}
      </div>
      <p className="text-muted-foreground font-mono text-[10px]">
        window {hud.window}ms · round {round.current}
      </p>
    </div>
  );
}
