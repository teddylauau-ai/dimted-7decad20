import { useEffect, useRef, useState } from "react";

/**
 * Comet Sling — you hold the centre of a collapsing system. Aim with the
 * pointer, click to fire, big comets split into small ones. Three leaks
 * through the core and the run ends.
 */

const W = 560;
const H = 400;
const CX = W / 2;
const CY = H / 2;

type Comet = { x: number; y: number; vx: number; vy: number; r: number };
type Shot = { x: number; y: number; vx: number; vy: number; life: number };

export function CometSling({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const aim = useRef({ x: CX + 60, y: CY });
  const fire = useRef(false);
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const [view, setView] = useState({ score: 0, lives: 3 });

  useEffect(() => {
    if (!running) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;

    let score = 0;
    let lives = 3;
    let over = false;
    let spawnIn = 0.8;
    let elapsed = 0;
    let cool = 0;
    let frame = 0;
    let last = performance.now();
    const comets: Comet[] = [];
    const shots: Shot[] = [];

    function spawn() {
      const edge = Math.floor(Math.random() * 4);
      const x = edge === 0 ? 0 : edge === 1 ? W : Math.random() * W;
      const y = edge === 2 ? 0 : edge === 3 ? H : Math.random() * H;
      const a = Math.atan2(CY - y, CX - x) + (Math.random() - 0.5) * 0.5;
      const spd = 42 + elapsed * 2.2 + Math.random() * 26;
      comets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: Math.random() < 0.45 ? 22 : 13 });
    }

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      elapsed += dt;
      cool -= dt;

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = Math.max(0.32, 1.1 - elapsed * 0.02);
      }

      if (fire.current && cool <= 0) {
        cool = 0.16;
        const a = Math.atan2(aim.current.y - CY, aim.current.x - CX);
        shots.push({ x: CX, y: CY, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 1.4 });
      }

      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]!;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0 || s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) shots.splice(i, 1);
      }

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i]!;
        c.x += c.vx * dt;
        c.y += c.vy * dt;

        if (Math.hypot(c.x - CX, c.y - CY) < 20 + c.r * 0.4) {
          comets.splice(i, 1);
          lives -= 1;
          if (lives <= 0) {
            over = true;
            cbs.current.onEnd(score);
            break;
          }
          continue;
        }

        let killed = false;
        for (let j = shots.length - 1; j >= 0; j--) {
          const s = shots[j]!;
          if (Math.hypot(s.x - c.x, s.y - c.y) < c.r + 4) {
            shots.splice(j, 1);
            comets.splice(i, 1);
            score += c.r > 18 ? 120 : 220;
            cbs.current.onScore(score);
            if (c.r > 18) {
              for (let k = 0; k < 2; k++) {
                const a = Math.random() * Math.PI * 2;
                comets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 13 });
              }
            }
            killed = true;
            break;
          }
        }
        if (killed) continue;
      }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(45,212,191,0.14)";
      for (let r = 60; r < 320; r += 60) {
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      const a = Math.atan2(aim.current.y - CY, aim.current.x - CX);
      ctx.strokeStyle = "rgba(251,191,36,0.35)";
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(a) * 120, CY + Math.sin(a) * 120);
      ctx.stroke();

      ctx.fillStyle = "#5eead4";
      ctx.shadowColor = "#2dd4bf";
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(CX, CY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#fbbf24";
      for (const s of shots) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const c of comets) {
        const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, c.r);
        g.addColorStop(0, "rgba(244,114,182,0.95)");
        g.addColorStop(1, "rgba(244,114,182,0.15)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (frame % 4 === 0) setView({ score, lives });
      frame++;
      if (!over) requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      over = true;
      cancelAnimationFrame(frame);
    };
  }, [running]);

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    aim.current = {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="text-muted-foreground flex w-full max-w-[560px] justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span>{"♥".repeat(Math.max(0, view.lives)) || "—"}</span>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        onPointerMove={move}
        onPointerDown={(e) => {
          move(e);
          fire.current = true;
        }}
        onPointerUp={() => (fire.current = false)}
        onPointerLeave={() => (fire.current = false)}
        className="border-border w-full max-w-[560px] cursor-crosshair touch-none rounded-xl border"
      />
    </div>
  );
}
