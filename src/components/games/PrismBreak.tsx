import { useEffect, useRef, useState } from "react";

/**
 * Prism Break — paddle, ball, and a wall of light. Bricks take one or two
 * hits, the ball speeds up per row cleared, and you get three balls.
 */

const W = 520;
const H = 380;
const COLS = 10;
const ROWS = 5;
const BW = W / COLS;
const BH = 20;
const PAD_W = 86;

type Brick = { x: number; y: number; hp: number };

export function PrismBreak({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const padX = useRef(W / 2);
  const keys = useRef({ left: false, right: false });
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const [view, setView] = useState({ score: 0, lives: 3, wave: 1 });

  useEffect(() => {
    if (!running) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;

    let score = 0;
    let lives = 3;
    let wave = 1;
    let over = false;
    let bricks: Brick[] = [];
    let bx = W / 2;
    let by = H - 60;
    let bvx = 190;
    let bvy = -260;
    let last = performance.now();
    let frame = 0;

    function build() {
      bricks = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          bricks.push({ x: c * BW, y: 44 + r * (BH + 6), hp: r < 2 ? 2 : 1 });
        }
      }
    }
    function launch() {
      bx = padX.current;
      by = H - 60;
      const spd = 300 + wave * 30;
      bvx = (Math.random() > 0.5 ? 1 : -1) * spd * 0.6;
      bvy = -spd;
    }
    build();
    launch();

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (keys.current.left) padX.current -= 460 * dt;
      if (keys.current.right) padX.current += 460 * dt;
      padX.current = Math.max(PAD_W / 2, Math.min(W - PAD_W / 2, padX.current));

      bx += bvx * dt;
      by += bvy * dt;
      if (bx < 8) {
        bx = 8;
        bvx = Math.abs(bvx);
      }
      if (bx > W - 8) {
        bx = W - 8;
        bvx = -Math.abs(bvx);
      }
      if (by < 8) {
        by = 8;
        bvy = Math.abs(bvy);
      }

      // paddle
      if (by > H - 26 && by < H - 12 && Math.abs(bx - padX.current) < PAD_W / 2 + 6 && bvy > 0) {
        bvy = -Math.abs(bvy);
        bvx += (bx - padX.current) * 5;
        bvx = Math.max(-460, Math.min(460, bvx));
      }

      if (by > H) {
        lives -= 1;
        if (lives <= 0) {
          over = true;
          cbs.current.onEnd(score);
        } else {
          launch();
        }
      }

      for (let i = bricks.length - 1; i >= 0; i--) {
        const b = bricks[i]!;
        if (bx > b.x && bx < b.x + BW && by > b.y && by < b.y + BH) {
          b.hp -= 1;
          score += 60 * wave;
          bvy = -bvy;
          if (b.hp <= 0) bricks.splice(i, 1);
          cbs.current.onScore(score);
          break;
        }
      }

      if (bricks.length === 0) {
        wave += 1;
        score += 500;
        build();
        launch();
        cbs.current.onScore(score);
      }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(0, 0, W, H);

      for (const b of bricks) {
        ctx.fillStyle = b.hp > 1 ? "#fbbf24" : "#2dd4bf";
        ctx.globalAlpha = b.hp > 1 ? 0.95 : 0.75;
        ctx.fillRect(b.x + 2, b.y, BW - 4, BH);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#5eead4";
      ctx.shadowColor = "#2dd4bf";
      ctx.shadowBlur = 14;
      ctx.fillRect(padX.current - PAD_W / 2, H - 18, PAD_W, 9);
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (frame % 4 === 0) setView({ score, lives, wave });
      frame++;
      if (!over) requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      over = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [running]);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="text-muted-foreground flex w-full max-w-[520px] justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-gold">wave {view.wave}</span>
        <span>{"♥".repeat(Math.max(0, view.lives)) || "—"}</span>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          padX.current = ((e.clientX - rect.left) / rect.width) * W;
        }}
        className="border-border w-full max-w-[520px] touch-none rounded-xl border"
      />
    </div>
  );
}
