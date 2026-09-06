import { useEffect, useRef, useState } from "react";

/**
 * Lane Hop — a Crossy Road style dash. Hop forward across lanes of traffic and
 * rivers of light; every lane you clear is a point, and the traffic gets faster
 * the deeper you go. One hit ends the run, and lagging too far back does too.
 */

const COLS = 9;
const CELL = 34;
const W = COLS * CELL;
const ROWS_VISIBLE = 12;
const H = ROWS_VISIBLE * CELL;

type Lane = {
  kind: "safe" | "road" | "river";
  dir: 1 | -1;
  speed: number;
  cars: number[]; // x positions in px
  carW: number;
};

function makeLane(index: number): Lane {
  if (index % 4 === 0 || index === 0) return { kind: "safe", dir: 1, speed: 0, cars: [], carW: 0 };
  const kind = Math.random() < 0.68 ? "road" : "river";
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const speed = (kind === "road" ? 0.9 : 0.6) + Math.min(2.6, index * 0.035) + Math.random() * 0.5;
  const carW = kind === "road" ? CELL * (Math.random() < 0.3 ? 2 : 1.3) : CELL * 2.4;
  const gap = kind === "road" ? CELL * (3 + Math.random() * 2) : CELL * 3.2;
  const cars: number[] = [];
  for (let x = -carW; x < W + carW; x += carW + gap) cars.push(x + Math.random() * 10);
  return { kind, dir, speed, cars, carW };
}

export function LaneHop({
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
    lanes: [] as Lane[],
    col: Math.floor(COLS / 2),
    row: 0,
    best: 0,
    score: 0,
    over: false,
    onLog: null as number | null,
    logX: 0,
  });
  const [view, setView] = useState({ score: 0, row: 0 });

  useEffect(() => {
    if (!running) return;
    const st = s.current;
    st.lanes = Array.from({ length: 120 }, (_, i) => makeLane(i));
    st.col = Math.floor(COLS / 2);
    st.row = 0;
    st.best = 0;
    st.score = 0;
    st.over = false;
    st.onLog = null;
    cbs.current.onScore(0);

    const ctx = canvas.current?.getContext("2d") ?? null;
    let frame = 0;
    let playerX = st.col * CELL;

    const ensure = (upTo: number) => {
      while (st.lanes.length < upTo + 24) st.lanes.push(makeLane(st.lanes.length));
    };

    const die = () => {
      if (st.over) return;
      st.over = true;
      cbs.current.onEnd(st.score);
    };

    const hop = (dc: number, dr: number) => {
      if (st.over) return;
      const nc = Math.min(COLS - 1, Math.max(0, st.col + dc));
      const nr = Math.max(0, st.row + dr);
      st.col = nc;
      st.row = nr;
      playerX = nc * CELL;
      ensure(nr);
      if (nr > st.best) {
        st.best = nr;
        st.score += 25 + Math.floor(nr / 5) * 5;
        cbs.current.onScore(st.score);
        setView({ score: st.score, row: nr });
      }
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const baseRow = Math.max(0, st.row - 3);
      for (let i = 0; i < ROWS_VISIBLE + 1; i++) {
        const idx = baseRow + i;
        const lane = st.lanes[idx];
        if (!lane) continue;
        const y = H - (idx - baseRow + 1) * CELL;
        ctx.fillStyle =
          lane.kind === "safe" ? "#10261f" : lane.kind === "road" ? "#111823" : "#0b1c33";
        ctx.fillRect(0, y, W, CELL);
        if (lane.kind === "road") {
          ctx.strokeStyle = "rgba(255,255,255,0.10)";
          ctx.setLineDash([8, 10]);
          ctx.beginPath();
          ctx.moveTo(0, y + CELL / 2);
          ctx.lineTo(W, y + CELL / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        for (const cx of lane.cars) {
          if (lane.kind === "road") {
            ctx.fillStyle = lane.dir > 0 ? "#ff6a8b" : "#ffb347";
            ctx.fillRect(cx, y + 5, lane.carW, CELL - 10);
          } else {
            ctx.fillStyle = "#2ee6c4";
            ctx.globalAlpha = 0.75;
            ctx.fillRect(cx, y + 7, lane.carW, CELL - 14);
            ctx.globalAlpha = 1;
          }
        }
      }
      // player
      const py = H - (st.row - baseRow + 1) * CELL;
      ctx.fillStyle = "#f6c860";
      ctx.shadowColor = "#f6c860";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(playerX + 6, py + 6, CELL - 12, CELL - 12, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const tick = () => {
      if (!st.over) {
        const baseRow = Math.max(0, st.row - 3);
        for (let i = 0; i < ROWS_VISIBLE + 1; i++) {
          const lane = st.lanes[baseRow + i];
          if (!lane || lane.kind === "safe") continue;
          for (let c = 0; c < lane.cars.length; c++) {
            lane.cars[c]! += lane.dir * lane.speed;
            if (lane.dir > 0 && lane.cars[c]! > W + lane.carW) lane.cars[c]! = -lane.carW * 2;
            if (lane.dir < 0 && lane.cars[c]! < -lane.carW * 2) lane.cars[c]! = W + lane.carW;
          }
        }
        const lane = st.lanes[st.row];
        if (lane && lane.kind !== "safe") {
          const px = st.col * CELL + CELL / 2;
          const hit = lane.cars.some((cx) => px > cx && px < cx + lane.carW);
          if (lane.kind === "road" && hit) die();
          if (lane.kind === "river") {
            if (!hit) die();
            else {
              // ride the raft
              playerX += lane.dir * lane.speed;
              if (playerX < -CELL / 2 || playerX > W - CELL / 2) die();
              st.col = Math.min(COLS - 1, Math.max(0, Math.round(playerX / CELL)));
            }
          }
        }
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w", "arrowdown", "s", "arrowleft", "a", "arrowright", "d"].includes(k)) e.preventDefault();
      if (k === "arrowup" || k === "w") hop(0, 1);
      else if (k === "arrowdown" || k === "s") hop(0, -1);
      else if (k === "arrowleft" || k === "a") hop(-1, 0);
      else if (k === "arrowright" || k === "d") hop(1, 0);
    };
    window.addEventListener("keydown", key);

    let touchStart: { x: number; y: number } | null = null;
    const el = canvas.current;
    const down = (e: PointerEvent) => {
      touchStart = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return hop(0, 1);
      if (Math.abs(dx) > Math.abs(dy)) hop(dx > 0 ? 1 : -1, 0);
      else hop(0, dy < 0 ? 1 : -1);
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
      <div className="text-muted-foreground flex w-full max-w-[306px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">lane {view.row}</span>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="border-border touch-none rounded-xl border"
        style={{ width: "min(306px, 86vw)", height: "auto" }}
      />
      <p className="text-muted-foreground font-mono text-[10px]">
        W / ↑ hop · A D sidestep · tap or swipe on mobile
      </p>
    </div>
  );
}
