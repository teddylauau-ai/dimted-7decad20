import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Pulse Grid — pure reaction. A tile lights for a shrinking window; hit it to
 * build a multiplier, miss three and the run ends.
 *
 * The whole run is driven by one rAF loop reading a mutable run object, so a
 * parent re-render can never clear a pending timer mid-run.
 */

const SIZE = 4;
const TILES = SIZE * SIZE;
const GAP_MS = 320;

type Run = {
  round: number;
  score: number;
  combo: number;
  misses: number;
  window: number;
  active: number | null;
  shownAt: number;
  nextAt: number;
  over: boolean;
};

export function PulseGrid({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const run = useRef<Run>({
    round: 0,
    score: 0,
    combo: 1,
    misses: 0,
    window: 1250,
    active: null,
    shownAt: 0,
    nextAt: 0,
    over: false,
  });

  const [view, setView] = useState({ score: 0, combo: 1, misses: 0, window: 1250, round: 0, active: null as number | null });
  const [hit, setHit] = useState<number | null>(null);
  const [miss, setMiss] = useState<number | null>(null);

  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };

  useEffect(() => {
    if (!running) return;
    const r = run.current;
    r.round = 0;
    r.score = 0;
    r.combo = 1;
    r.misses = 0;
    r.window = 1250;
    r.active = null;
    r.over = false;
    r.nextAt = performance.now() + 500;
    cbs.current.onScore(0);

    let frame = 0;
    const tick = (now: number) => {
      const s = run.current;
      if (!s.over) {
        if (s.active == null) {
          if (now >= s.nextAt) {
            s.round += 1;
            s.window = Math.max(420, 1250 - s.round * 26);
            s.active = Math.floor(Math.random() * TILES);
            s.shownAt = now;
          }
        } else if (now - s.shownAt >= s.window) {
          const missed = s.active;
          s.active = null;
          s.combo = 1;
          s.misses += 1;
          s.nextAt = now + GAP_MS;
          setMiss(missed);
          window.setTimeout(() => setMiss(null), 200);
          if (s.misses >= 3) {
            s.over = true;
            cbs.current.onEnd(s.score);
          }
        }
        setView({ score: s.score, combo: s.combo, misses: s.misses, window: s.window, round: s.round, active: s.active });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      run.current.over = true;
    };
  }, [running]);

  function tap(index: number) {
    const s = run.current;
    if (!running || s.over) return;
    if (index !== s.active) {
      s.combo = 1;
      setMiss(index);
      window.setTimeout(() => setMiss(null), 180);
      return;
    }
    const reaction = performance.now() - s.shownAt;
    const speedBonus = Math.max(10, Math.round((s.window - reaction) / 4));
    s.combo = Math.min(10, s.combo + 1);
    s.score += (50 + speedBonus) * s.combo;
    s.active = null;
    s.nextAt = performance.now() + 180;
    cbs.current.onScore(s.score);
    setHit(index);
    window.setTimeout(() => setHit(null), 160);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[340px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-gold">×{view.combo}</span>
        <span>{"♥".repeat(Math.max(0, 3 - view.misses)) || "—"}</span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, width: "min(340px, 86vw)" }}
      >
        {Array.from({ length: TILES }, (_, i) => (
          <button
            key={i}
            onPointerDown={() => tap(i)}
            data-live={i === view.active ? "true" : undefined}
            className={cn(
              "aspect-square rounded-xl border transition-[background-color,box-shadow,transform] duration-100",
              i === view.active
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
        window {view.window}ms · round {view.round}
      </p>
    </div>
  );
}
