import { useEffect, useRef, useState } from "react";

/**
 * Neon Coil — snake with portals. Eat cores to grow, use the edge portals to
 * wrap around, and dodge the drifting mines that appear as you get longer.
 */

const GRID = 19;
const CELL = 18;
const SIZE = GRID * CELL;

type P = { x: number; y: number };

const eq = (a: P, b: P) => a.x === b.x && a.y === b.y;

export function NeonCoil({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const s = useRef({
    body: [] as P[],
    dir: { x: 1, y: 0 },
    queued: [] as P[],
    core: { x: 12, y: 9 } as P,
    mines: [] as P[],
    score: 0,
    over: false,
    stepMs: 140,
    last: 0,
  });
  const [view, setView] = useState({ score: 0, len: 3 });

  useEffect(() => {
    if (!running) return;
    const st = s.current;
    const mid = Math.floor(GRID / 2);
    st.body = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    st.dir = { x: 1, y: 0 };
    st.queued = [];
    st.mines = [];
    st.score = 0;
    st.over = false;
    st.stepMs = 140;
    st.last = 0;
    cbs.current.onScore(0);

    const free = (): P => {
      let p: P;
      do {
        p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      } while (st.body.some((b) => eq(b, p)) || st.mines.some((m) => eq(m, p)));
      return p;
    };
    st.core = free();

    const ctx = canvas.current?.getContext("2d") ?? null;
    let frame = 0;

    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = "#070c14";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, SIZE);
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(SIZE, i * CELL);
        ctx.stroke();
      }
      // core
      ctx.fillStyle = "#f6c860";
      ctx.shadowColor = "#f6c860";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(st.core.x * CELL + CELL / 2, st.core.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // mines
      ctx.fillStyle = "#ff6a8b";
      for (const m of st.mines) {
        ctx.beginPath();
        ctx.arc(m.x * CELL + CELL / 2, m.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // body
      st.body.forEach((b, i) => {
        const t = 1 - i / Math.max(6, st.body.length);
        ctx.fillStyle = i === 0 ? "#5ffbe0" : `rgba(46,230,196,${0.28 + t * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(b.x * CELL + 2, b.y * CELL + 2, CELL - 4, CELL - 4, 5);
        ctx.fill();
      });
    };

    const step = () => {
      const next = st.queued.shift();
      if (next) st.dir = next;
      const head = st.body[0]!;
      const nh = {
        x: (head.x + st.dir.x + GRID) % GRID,
        y: (head.y + st.dir.y + GRID) % GRID,
      };
      if (st.body.some((b) => eq(b, nh)) || st.mines.some((m) => eq(m, nh))) {
        st.over = true;
        cbs.current.onEnd(st.score);
        return;
      }
      st.body.unshift(nh);
      if (eq(nh, st.core)) {
        st.score += 90 + st.body.length * 6;
        cbs.current.onScore(st.score);
        st.core = free();
        st.stepMs = Math.max(70, st.stepMs - 2.5);
        if (st.body.length % 5 === 0 && st.mines.length < 14) st.mines.push(free());
        setView({ score: st.score, len: st.body.length });
      } else {
        st.body.pop();
      }
    };

    const tick = (now: number) => {
      if (!st.over) {
        if (now - st.last >= st.stepMs) {
          st.last = now;
          step();
        }
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const turn = (x: number, y: number) => {
      const cur = st.queued[st.queued.length - 1] ?? st.dir;
      if (cur.x === -x && cur.y === -y) return;
      if (cur.x === x && cur.y === y) return;
      if (st.queued.length < 2) st.queued.push({ x, y });
    };
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k))
        e.preventDefault();
      if (k === "arrowup" || k === "w") turn(0, -1);
      else if (k === "arrowdown" || k === "s") turn(0, 1);
      else if (k === "arrowleft" || k === "a") turn(-1, 0);
      else if (k === "arrowright" || k === "d") turn(1, 0);
    };
    window.addEventListener("keydown", key);

    const el = canvas.current;
    let start: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
      else turn(0, dy > 0 ? 1 : -1);
    };
    el?.addEventListener("pointerdown", down);
    el?.addEventListener("pointerup", up);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
      el?.removeEventListener("pointerdown", down);
      el?.removeEventListener("pointerup", up);
      s.current.over = true;
    };
  }, [running]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[342px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">length {view.len}</span>
      </div>
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        className="border-border touch-none rounded-xl border"
        style={{ width: "min(342px, 86vw)", height: "auto" }}
      />
      <p className="text-muted-foreground font-mono text-[10px]">
        Arrows / WASD / swipe · edges wrap around
      </p>
    </div>
  );
}
