import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Nova Blocks — a real falling-block puzzle. Board state lives in a ref so the
 * game loop never fights React's batching; we mirror it into state to paint.
 */

const COLS = 10;
const ROWS = 18;

type Cell = number; // 0 = empty, else piece index + 1

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [0, 1, 0],
    [1, 1, 1],
  ], // T
  [
    [1, 0, 0],
    [1, 1, 1],
  ], // J
  [
    [0, 0, 1],
    [1, 1, 1],
  ], // L
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // S
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // Z
];

const COLORS = [
  "bg-primary shadow-[0_0_12px_-2px_var(--color-primary)]",
  "bg-gold shadow-[0_0_12px_-2px_var(--color-gold)]",
  "bg-xp shadow-[0_0_12px_-2px_var(--color-xp)]",
  "bg-energy shadow-[0_0_12px_-2px_var(--color-energy)]",
  "bg-secret shadow-[0_0_12px_-2px_var(--color-secret)]",
  "bg-primary/70",
  "bg-gold/70",
];

type Piece = { grid: number[][]; kind: number; x: number; y: number };

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
}

function rotate(grid: number[][]): number[][] {
  const h = grid.length;
  const w = grid[0]!.length;
  return Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => grid[h - 1 - x]![y]!));
}

function spawn(): Piece {
  const kind = Math.floor(Math.random() * SHAPES.length);
  const grid = SHAPES[kind]!.map((r) => [...r]);
  return { grid, kind, x: Math.floor((COLS - grid[0]!.length) / 2), y: 0 };
}

function collides(board: Cell[][], p: Piece): boolean {
  for (let y = 0; y < p.grid.length; y++) {
    for (let x = 0; x < p.grid[y]!.length; x++) {
      if (!p.grid[y]![x]) continue;
      const by = p.y + y;
      const bx = p.x + x;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by]![bx]) return true;
    }
  }
  return false;
}

export function NovaBlocks({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const board = useRef<Cell[][]>(emptyBoard());
  const piece = useRef<Piece>(spawn());
  const next = useRef<Piece>(spawn());
  const score = useRef(0);
  const lines = useRef(0);
  const dead = useRef(false);
  const [view, setView] = useState<Cell[][]>(emptyBoard());
  const [stats, setStats] = useState({ score: 0, lines: 0, level: 1 });
  const [flash, setFlash] = useState(false);

  const paint = useCallback(() => {
    const merged = board.current.map((row) => [...row]);
    const p = piece.current;
    for (let y = 0; y < p.grid.length; y++) {
      for (let x = 0; x < p.grid[y]!.length; x++) {
        if (!p.grid[y]![x]) continue;
        const by = p.y + y;
        if (by >= 0) merged[by]![p.x + x] = p.kind + 1;
      }
    }
    setView(merged);
    const level = Math.min(12, 1 + Math.floor(lines.current / 8));
    setStats({ score: score.current, lines: lines.current, level });
  }, []);

  // Reset on each fresh run.
  useEffect(() => {
    if (!running) return;
    board.current = emptyBoard();
    piece.current = spawn();
    next.current = spawn();
    score.current = 0;
    lines.current = 0;
    dead.current = false;
    paint();
    onScore(0);
  }, [running, paint, onScore]);

  const lockPiece = useCallback(() => {
    const p = piece.current;
    for (let y = 0; y < p.grid.length; y++) {
      for (let x = 0; x < p.grid[y]!.length; x++) {
        if (!p.grid[y]![x]) continue;
        const by = p.y + y;
        if (by < 0) continue;
        board.current[by]![p.x + x] = p.kind + 1;
      }
    }

    const kept = board.current.filter((row) => row.some((c) => !c));
    const cleared = ROWS - kept.length;
    if (cleared > 0) {
      board.current = [
        ...Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(0)),
        ...kept,
      ];
      lines.current += cleared;
      const level = 1 + Math.floor(lines.current / 8);
      score.current += [0, 100, 300, 500, 800][cleared]! * level;
      if (cleared === 4) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 320);
      }
    }
    score.current += 12; // reward for every placement
    onScore(score.current);

    piece.current = next.current;
    next.current = spawn();
    if (collides(board.current, piece.current)) {
      dead.current = true;
      onEnd(score.current);
    }
  }, [onEnd, onScore]);

  const step = useCallback(() => {
    if (dead.current) return;
    const p = piece.current;
    const moved = { ...p, y: p.y + 1 };
    if (collides(board.current, moved)) lockPiece();
    else piece.current = moved;
    paint();
  }, [lockPiece, paint]);

  // Gravity: rAF with an accumulator so speed changes take effect immediately.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (t: number) => {
      const level = Math.min(12, 1 + Math.floor(lines.current / 8));
      const interval = Math.max(90, 720 - (level - 1) * 55);
      acc += t - last;
      last = t;
      while (acc >= interval) {
        acc -= interval;
        step();
      }
      if (!dead.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, step]);

  const move = useCallback(
    (dx: number) => {
      const p = piece.current;
      const moved = { ...p, x: p.x + dx };
      if (!collides(board.current, moved)) piece.current = moved;
      paint();
    },
    [paint],
  );

  const spin = useCallback(() => {
    const p = piece.current;
    const grid = rotate(p.grid);
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = { ...p, grid, x: p.x + kick };
      if (!collides(board.current, candidate)) {
        piece.current = candidate;
        break;
      }
    }
    paint();
  }, [paint]);

  const hardDrop = useCallback(() => {
    while (!collides(board.current, { ...piece.current, y: piece.current.y + 1 })) {
      piece.current = { ...piece.current, y: piece.current.y + 1 };
      score.current += 2;
    }
    lockPiece();
    paint();
  }, [lockPiece, paint]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "a", "d", "w", "s"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "a") move(-1);
      else if (e.key === "ArrowRight" || e.key === "d") move(1);
      else if (e.key === "ArrowUp" || e.key === "w") spin();
      else if (e.key === "ArrowDown" || e.key === "s") step();
      else if (e.key === " ") hardDrop();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [running, move, spin, step, hardDrop]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[320px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{stats.score.toLocaleString()}</span>
        <span>lines {stats.lines}</span>
        <span className="text-gold">lv {stats.level}</span>
      </div>

      <div
        className={cn(
          "bg-background/70 ring-border grid gap-[2px] rounded-xl p-2 ring-1 transition-shadow",
          flash && "ring-gold shadow-[0_0_40px_-6px_var(--color-gold)]",
        )}
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, width: "min(320px, 86vw)" }}
      >
        {view.flatMap((row, y) =>
          row.map((cell, x) => (
            <span
              key={`${y}-${x}`}
              className={cn(
                "aspect-square rounded-[3px] transition-colors duration-75",
                cell ? COLORS[cell - 1] : "bg-secondary/35",
              )}
            />
          )),
        )}
      </div>

      {/* Touch controls */}
      <div className="grid w-full max-w-[320px] grid-cols-4 gap-2 lg:hidden">
        {[
          { label: "←", fn: () => move(-1) },
          { label: "⟳", fn: spin },
          { label: "→", fn: () => move(1) },
          { label: "⤓", fn: hardDrop },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            className="border-border bg-secondary/50 active:bg-secondary rounded-xl border py-3 text-sm"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
