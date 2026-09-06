import { useEffect, useRef, useState } from "react";

/**
 * Tower Stack — the classic "stack" game. A slab slides back and forth above
 * the tower; tap to drop it. Overhang is sliced off, so every sloppy drop makes
 * the next one harder. Perfect drops regrow a little width and pay a combo.
 */

const W = 320;
const H = 420;
const SLAB_H = 18;

type Slab = { x: number; w: number };

export function TowerStack({
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
  const state = useRef({
    stack: [] as Slab[],
    cur: { x: 0, w: 200 } as Slab,
    dir: 1,
    speed: 1.8,
    score: 0,
    combo: 0,
    over: false,
    camera: 0,
  });
  const [view, setView] = useState({ score: 0, combo: 0 });

  useEffect(() => {
    if (!running) return;
    const s = state.current;
    s.stack = [{ x: (W - 200) / 2, w: 200 }];
    s.cur = { x: 0, w: 200 };
    s.dir = 1;
    s.speed = 1.8;
    s.score = 0;
    s.combo = 0;
    s.over = false;
    s.camera = 0;
    cbs.current.onScore(0);

    const ctx = canvas.current?.getContext("2d") ?? null;
    let frame = 0;

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0a1220");
      grad.addColorStop(1, "#050910");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const baseY = H - 40 + s.camera;
      s.stack.forEach((slab, i) => {
        const y = baseY - i * SLAB_H;
        if (y < -SLAB_H || y > H) return;
        const t = i / Math.max(1, s.stack.length);
        ctx.fillStyle = `hsl(${175 + t * 90} 70% ${42 + (i % 2) * 8}%)`;
        ctx.fillRect(slab.x, y, slab.w, SLAB_H - 2);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(slab.x, y, slab.w, 2);
      });

      if (!s.over) {
        const y = baseY - s.stack.length * SLAB_H;
        ctx.fillStyle = "#f6c860";
        ctx.shadowColor = "#f6c860";
        ctx.shadowBlur = 18;
        ctx.fillRect(s.cur.x, y, s.cur.w, SLAB_H - 2);
        ctx.shadowBlur = 0;
      }
    };

    const tick = () => {
      if (!s.over) {
        s.cur.x += s.dir * s.speed;
        if (s.cur.x + s.cur.w > W) {
          s.cur.x = W - s.cur.w;
          s.dir = -1;
        }
        if (s.cur.x < 0) {
          s.cur.x = 0;
          s.dir = 1;
        }
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const drop = () => {
      if (s.over) return;
      const top = s.stack[s.stack.length - 1]!;
      const left = Math.max(s.cur.x, top.x);
      const right = Math.min(s.cur.x + s.cur.w, top.x + top.w);
      const w = right - left;
      if (w <= 4) {
        s.over = true;
        cbs.current.onEnd(s.score);
        return;
      }
      const off = Math.abs(s.cur.x - top.x);
      let width = w;
      if (off <= 4) {
        s.combo += 1;
        width = Math.min(200, w + 6);
        s.score += 100 + s.combo * 40;
      } else {
        s.combo = 0;
        s.score += 60;
      }
      s.stack.push({ x: off <= 4 ? top.x : left, w: width });
      s.cur = { x: 0, w: width };
      s.dir = 1;
      s.speed = Math.min(7.2, 1.8 + s.stack.length * 0.11);
      if (s.stack.length * SLAB_H > H - 140) s.camera += SLAB_H;
      cbs.current.onScore(s.score);
      setView({ score: s.score, combo: s.combo });
    };

    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowDown" || e.code === "Enter") {
        e.preventDefault();
        drop();
      }
    };
    const el = canvas.current;
    const pointer = (e: Event) => {
      e.preventDefault();
      drop();
    };
    window.addEventListener("keydown", key);
    el?.addEventListener("pointerdown", pointer);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
      el?.removeEventListener("pointerdown", pointer);
      state.current.over = true;
    };
  }, [running]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[320px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-gold">{view.combo > 0 ? `perfect ×${view.combo}` : "—"}</span>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="border-border touch-none rounded-xl border"
        style={{ width: "min(320px, 86vw)", height: "auto" }}
      />
      <p className="text-muted-foreground font-mono text-[10px]">Space / tap to drop</p>
    </div>
  );
}
