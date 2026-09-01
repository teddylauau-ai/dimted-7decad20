import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Nova Fusion — slide and merge glowing cores. Arrow keys, WASD or swipe.
 * Merging doubles a core and pays its value; no legal moves ends the run.
 */

const N = 4;
type Grid = number[];

function emptyGrid(): Grid {
  return Array<number>(N * N).fill(0);
}
function addTile(g: Grid) {
  const free = g.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (!free.length) return;
  const idx = free[Math.floor(Math.random() * free.length)]!;
  g[idx] = Math.random() < 0.9 ? 2 : 4;
}
function rowsOf(g: Grid, dir: "left" | "right" | "up" | "down"): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < N; i++) {
    const line: number[] = [];
    for (let j = 0; j < N; j++) {
      const v =
        dir === "left" || dir === "right" ? g[i * N + j]! : g[j * N + i]!;
      line.push(v);
    }
    rows.push(dir === "right" || dir === "down" ? line.reverse() : line);
  }
  return rows;
}
function writeRows(g: Grid, rows: number[][], dir: "left" | "right" | "up" | "down") {
  rows.forEach((row, i) => {
    const line = dir === "right" || dir === "down" ? [...row].reverse() : row;
    line.forEach((v, j) => {
      if (dir === "left" || dir === "right") g[i * N + j] = v;
      else g[j * N + i] = v;
    });
  });
}
function slide(line: number[]): { line: number[]; gained: number } {
  const vals = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      const merged = vals[i]! * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else out.push(vals[i]!);
  }
  while (out.length < N) out.push(0);
  return { line: out, gained };
}
function move(g: Grid, dir: "left" | "right" | "up" | "down") {
  const next = [...g];
  const rows = rowsOf(next, dir).map((r) => slide(r));
  writeRows(next, rows.map((r) => r.line), dir);
  const gained = rows.reduce((s, r) => s + r.gained, 0);
  const moved = next.some((v, i) => v !== g[i]);
  return { next, gained, moved };
}
function stuck(g: Grid) {
  return (["left", "right", "up", "down"] as const).every((d) => !move(g, d).moved);
}

const TONE: Record<number, string> = {
  2: "bg-secondary text-foreground/80",
  4: "bg-secondary/80 text-foreground",
  8: "bg-primary/25 text-primary",
  16: "bg-primary/40 text-primary",
  32: "bg-primary/60 text-background",
  64: "bg-primary/80 text-background",
  128: "bg-gold/40 text-gold",
  256: "bg-gold/60 text-background",
  512: "bg-gold/80 text-background",
  1024: "bg-gold text-background",
  2048: "bg-gold text-background shadow-[0_0_30px_-4px_var(--color-gold)]",
};

export function NovaFusion({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [score, setScore] = useState(0);
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const over = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!running) return;
    const g = emptyGrid();
    addTile(g);
    addTile(g);
    setGrid(g);
    setScore(0);
    over.current = false;
    cbs.current.onScore(0);
  }, [running]);

  const push = useCallback((dir: "left" | "right" | "up" | "down") => {
    if (over.current) return;
    setGrid((g) => {
      const { next, gained, moved } = move(g, dir);
      if (!moved) return g;
      addTile(next);
      setScore((s) => {
        const total = s + gained;
        cbs.current.onScore(total);
        if (stuck(next)) {
          over.current = true;
          cbs.current.onEnd(total);
        }
        return total;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const key = (e: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
        ArrowUp: "up",
        KeyW: "up",
        ArrowDown: "down",
        KeyS: "down",
      };
      const dir = map[e.code];
      if (!dir) return;
      e.preventDefault();
      push(dir);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [running, push]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[340px] justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{score.toLocaleString()}</span>
        <span>arrows / swipe</span>
      </div>
      <div
        className="grid touch-none gap-2"
        style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))`, width: "min(340px, 86vw)" }}
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
          push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}
      >
        {grid.map((v, i) => (
          <div
            key={i}
            className={cn(
              "font-display grid aspect-square place-items-center rounded-xl border text-lg font-semibold transition-colors",
              v === 0 ? "border-border/60 bg-background/40" : "border-transparent",
              v > 0 && (TONE[v] ?? "bg-gold text-background"),
            )}
          >
            {v > 0 ? v : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
