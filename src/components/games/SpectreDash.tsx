import { useEffect, useRef, useState } from "react";

/**
 * Spectre Dash — one-button rhythm runner in the Geometry Dash tradition.
 * The cube auto-runs; you jump. Spikes kill instantly, pads fling you high,
 * and the world accelerates the longer you survive. Score is distance.
 */

const W = 640;
const H = 320;
const GROUND = H - 56;
const GRAVITY = 2400;
const JUMP = 760;

type Obstacle = { x: number; kind: "spike" | "block" | "pad" | "double"; w: number; h: number };

export function SpectreDash({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const jumpQueued = useRef(false);
  const [view, setView] = useState({ score: 0, speed: 300 });

  useEffect(() => {
    if (!running) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;

    let y = GROUND;
    let vy = 0;
    let onGround = true;
    let rot = 0;
    let speed = 320;
    let dist = 0;
    let spawnIn = 420;
    let over = false;
    let last = performance.now();
    let frame = 0;
    const obstacles: Obstacle[] = [];
    const trail: { x: number; y: number; a: number }[] = [];

    function spawn() {
      const roll = Math.random();
      if (roll < 0.42) obstacles.push({ x: W + 40, kind: "spike", w: 26, h: 30 });
      else if (roll < 0.62) obstacles.push({ x: W + 40, kind: "double", w: 60, h: 30 });
      else if (roll < 0.85) obstacles.push({ x: W + 40, kind: "block", w: 34, h: 46 });
      else obstacles.push({ x: W + 40, kind: "pad", w: 34, h: 8 });
    }

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (!over) {
        speed += dt * 9;
        dist += speed * dt;

        if (jumpQueued.current) {
          jumpQueued.current = false;
          if (onGround) {
            vy = -JUMP;
            onGround = false;
          }
        }

        vy += GRAVITY * dt;
        y += vy * dt;
        if (y >= GROUND) {
          y = GROUND;
          vy = 0;
          onGround = true;
        }
        rot = onGround ? Math.round(rot / (Math.PI / 2)) * (Math.PI / 2) : rot + dt * 7;

        spawnIn -= speed * dt;
        if (spawnIn <= 0) {
          spawn();
          spawnIn = 240 + Math.random() * 260;
        }

        const px = 90;
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i]!;
          o.x -= speed * dt;
          if (o.x + o.w < -20) {
            obstacles.splice(i, 1);
            continue;
          }
          const hitX = px + 22 > o.x && px - 6 < o.x + o.w;
          const feet = y;
          if (o.kind === "pad") {
            if (hitX && feet > GROUND - 14) {
              vy = -JUMP * 1.42;
              onGround = false;
            }
            continue;
          }
          const top = GROUND - o.h;
          if (hitX && feet > top + 6) {
            over = true;
            cbs.current.onEnd(Math.round(dist / 10));
            break;
          }
          // Landing cleanly on top of a block is survivable.
          if (o.kind === "block" && hitX && feet <= top + 6 && vy >= 0) {
            y = top;
            vy = 0;
            onGround = true;
          }
        }

        trail.push({ x: px, y, a: 1 });
        if (trail.length > 16) trail.shift();
        for (const t of trail) {
          t.a -= dt * 2.4;
          t.x -= speed * dt * 0.4;
        }

        cbs.current.onScore(Math.round(dist / 10));
        if (frame % 4 === 0) setView({ score: Math.round(dist / 10), speed: Math.round(speed) });
      }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0b1120");
      sky.addColorStop(1, "#111c33");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // parallax bars
      ctx.fillStyle = "rgba(45,212,191,0.07)";
      for (let i = 0; i < 12; i++) {
        const x = ((i * 90 - dist * 0.25) % (W + 120)) - 60;
        ctx.fillRect(x, 60, 34, GROUND - 60);
      }

      ctx.strokeStyle = "rgba(45,212,191,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND + 1);
      ctx.lineTo(W, GROUND + 1);
      ctx.stroke();
      ctx.fillStyle = "rgba(13,20,36,0.9)";
      ctx.fillRect(0, GROUND + 2, W, H - GROUND);

      for (const o of obstacles) {
        if (o.kind === "spike" || o.kind === "double") {
          const count = o.kind === "double" ? 2 : 1;
          for (let s = 0; s < count; s++) {
            const bx = o.x + s * 30;
            ctx.fillStyle = "#f472b6";
            ctx.beginPath();
            ctx.moveTo(bx, GROUND);
            ctx.lineTo(bx + 13, GROUND - o.h);
            ctx.lineTo(bx + 26, GROUND);
            ctx.closePath();
            ctx.fill();
          }
        } else if (o.kind === "block") {
          ctx.fillStyle = "#334155";
          ctx.strokeStyle = "rgba(148,163,184,0.8)";
          ctx.fillRect(o.x, GROUND - o.h, o.w, o.h);
          ctx.strokeRect(o.x, GROUND - o.h, o.w, o.h);
        } else {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(o.x, GROUND - 8, o.w, 8);
        }
      }

      for (const t of trail) {
        if (t.a <= 0) continue;
        ctx.fillStyle = `rgba(45,212,191,${Math.max(0, t.a) * 0.25})`;
        ctx.fillRect(t.x, t.y - 22, 22, 22);
      }

      ctx.save();
      ctx.translate(90 + 11, y - 11);
      ctx.rotate(rot);
      ctx.fillStyle = "#5eead4";
      ctx.shadowColor = "#2dd4bf";
      ctx.shadowBlur = 18;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();

      frame++;
      if (!over) requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jumpQueued.current = true;
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      over = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
    };
  }, [running]);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="text-muted-foreground flex w-full max-w-[640px] justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}m</span>
        <span>speed {view.speed}</span>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        onPointerDown={() => (jumpQueued.current = true)}
        className="border-border w-full max-w-[640px] cursor-pointer touch-none rounded-xl border"
      />
    </div>
  );
}
