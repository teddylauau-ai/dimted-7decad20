import { useEffect, useRef, useState } from "react";

/**
 * Aurora Drift — canvas endless dodger. Steer a glider through gaps in
 * collapsing walls of light and collect motes for a combo multiplier.
 */

const W = 360;
const H = 520;

type Wall = { y: number; gapX: number; gapW: number; passed: boolean };
type Mote = { x: number; y: number; taken: boolean };

export function AuroraDrift({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ score: 0, combo: 1 });

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;

    let raf = 0;
    let last = performance.now();
    let alive = true;

    let x = W / 2;
    let vx = 0;
    let target = W / 2;
    let usePointer = false;
    const keys = new Set<string>();

    let speed = 0.14; // px per ms
    let score = 0;
    let combo = 1;
    let spawnAcc = 0;
    let trail: { x: number; y: number }[] = [];
    const walls: Wall[] = [];
    const motes: Mote[] = [];

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key)) {
        e.preventDefault();
        usePointer = false;
        keys.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key);
    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      usePointer = true;
      target = ((e.clientX - rect.left) / rect.width) * W;
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerdown", onPointer);

    function spawnWall() {
      const gapW = Math.max(64, 128 - score / 120);
      const gapX = 18 + Math.random() * (W - 36 - gapW);
      walls.push({ y: -20, gapX, gapW, passed: false });
      if (Math.random() < 0.8) {
        motes.push({ x: gapX + gapW / 2 + (Math.random() - 0.5) * (gapW * 0.5), y: -70, taken: false });
      }
    }

    const playerY = H - 78;

    function frame(t: number) {
      const dt = Math.min(34, t - last);
      last = t;

      // steering
      if (usePointer) {
        vx += (target - x) * 0.012 * dt * 0.6;
      } else {
        const dir = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
        vx += dir * 0.055 * dt;
      }
      vx *= 0.9;
      x = Math.max(14, Math.min(W - 14, x + vx));

      speed = Math.min(0.42, 0.14 + score / 9000);
      spawnAcc += dt;
      const spawnEvery = Math.max(560, 1100 - score / 4);
      if (spawnAcc > spawnEvery) {
        spawnAcc = 0;
        spawnWall();
      }

      for (const w of walls) w.y += speed * dt;
      for (const m of motes) m.y += speed * dt;

      // collisions
      for (const w of walls) {
        if (Math.abs(w.y - playerY) < 9) {
          if (x < w.gapX + 8 || x > w.gapX + w.gapW - 8) {
            alive = false;
          }
        }
        if (!w.passed && w.y > playerY + 10) {
          w.passed = true;
          score += 60 * combo;
        }
      }
      for (const m of motes) {
        if (!m.taken && Math.hypot(m.x - x, m.y - playerY) < 16) {
          m.taken = true;
          combo = Math.min(6, combo + 1);
          score += 40 * combo;
        } else if (!m.taken && m.y > playerY + 40) {
          m.taken = true;
          combo = 1;
        }
      }
      while (walls.length && walls[0]!.y > H + 30) walls.shift();
      while (motes.length && motes[0]!.y > H + 30) motes.shift();

      score += dt * 0.02 * combo;

      // ---- draw
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a1020");
      bg.addColorStop(1, "#060a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      for (let gy = (t * speed * 0.2) % 40; gy < H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      for (const w of walls) {
        const grad = ctx.createLinearGradient(0, w.y - 8, 0, w.y + 8);
        grad.addColorStop(0, "rgba(45,212,191,0)");
        grad.addColorStop(0.5, "rgba(45,212,191,0.95)");
        grad.addColorStop(1, "rgba(45,212,191,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, w.y - 8, w.gapX, 16);
        ctx.fillRect(w.gapX + w.gapW, w.y - 8, W - (w.gapX + w.gapW), 16);
        ctx.fillStyle = "rgba(250,204,21,0.5)";
        ctx.fillRect(w.gapX - 2, w.y - 1, 2, 2);
        ctx.fillRect(w.gapX + w.gapW, w.y - 1, 2, 2);
      }

      for (const m of motes) {
        if (m.taken) continue;
        ctx.beginPath();
        ctx.fillStyle = "rgba(250,204,21,0.95)";
        ctx.shadowColor = "rgba(250,204,21,0.8)";
        ctx.shadowBlur = 14;
        ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      trail.push({ x, y: playerY });
      if (trail.length > 16) trail = trail.slice(-16);
      trail.forEach((p, i) => {
        ctx.globalAlpha = (i / trail.length) * 0.35;
        ctx.fillStyle = "#2dd4bf";
        ctx.beginPath();
        ctx.arc(p.x, p.y + (trail.length - i) * 2.2, 5 * (i / trail.length), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(x, playerY);
      ctx.rotate(Math.max(-0.4, Math.min(0.4, vx * 0.03)));
      ctx.fillStyle = "#e8fbf7";
      ctx.shadowColor = "#2dd4bf";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;

      setHud({ score: Math.round(score), combo });
      onScore(Math.round(score));

      if (!alive) {
        onEnd(Math.round(score));
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, [running, onEnd, onScore]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[360px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{hud.score.toLocaleString()}</span>
        <span className="text-gold">×{hud.combo} combo</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="ring-border touch-none rounded-xl ring-1"
        style={{ width: "min(360px, 86vw)", height: "auto" }}
      />
    </div>
  );
}
