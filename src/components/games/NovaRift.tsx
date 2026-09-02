import { useEffect, useRef, useState } from "react";
import {
  FLOOR_Y,
  VIEW_H,
  VIEW_W,
  abilitiesFor,
  type LevelDef,
  type Rect,
} from "@/lib/campaign";

/**
 * Nova Rift — hand-designed precision platformer. Each level is a fixed layout
 * with shards to collect and a par time to beat, so progress is skill, not luck.
 */

const GRAVITY = 2400;
const JUMP = 780;
const RUN = 320;
const AIR = 0.86;
const DASH_SPEED = 720;
const DASH_TIME = 0.16;
const PW = 22;
const PH = 26;

type Solid = Rect;

function hit(ax: number, ay: number, aw: number, ah: number, b: Rect) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export function NovaRift({
  level,
  running,
  onWin,
  onFail,
  onShards,
}: {
  level: LevelDef;
  running: boolean;
  onWin: (shards: number, ms: number) => void;
  onFail: () => void;
  onShards?: (shards: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cbs = useRef({ onWin, onFail, onShards });
  cbs.current = { onWin, onFail, onShards };
  const keys = useRef<Record<string, boolean>>({});
  const jumpQueued = useRef(false);
  const dashQueued = useRef(false);
  const [hud, setHud] = useState({ shards: 0, ms: 0 });

  useEffect(() => {
    if (!running) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;

    const abilities = abilitiesFor(level.n);
    const canDouble = abilities.includes("double-jump");
    const canDash = abilities.includes("dash");

    const solids: Solid[] = [
      ...level.ground.map((seg) => ({ x: seg.x, y: FLOOR_Y, w: seg.w, h: 120 })),
      ...level.platforms,
    ];
    const shards = level.shards.map((sh) => ({ ...sh, got: false }));
    const movers = (level.movers ?? []).map((m) => ({ ...m, t: Math.random() * Math.PI * 2, cx: m.x }));

    let x = 40;
    let y = FLOOR_Y - PH;
    let vx = 0;
    let vy = 0;
    let onGround = true;
    let jumpsLeft = canDouble ? 2 : 1;
    let dashLeft = 0;
    let dashCool = 0;
    let cam = 0;
    let done = false;
    let started = performance.now();
    let last = started;
    let frame = 0;
    let shake = 0;
    let collected = 0;
    const trail: { x: number; y: number; a: number }[] = [];

    const die = () => {
      if (done) return;
      done = true;
      cbs.current.onFail();
    };
    const win = () => {
      if (done) return;
      done = true;
      cbs.current.onWin(collected, Math.round(performance.now() - started));
    };

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      if (done) return;

      // ---- input
      const left = keys.current["ArrowLeft"] || keys.current["a"] || keys.current["A"];
      const right = keys.current["ArrowRight"] || keys.current["d"] || keys.current["D"];
      const target = (right ? RUN : 0) - (left ? RUN : 0);
      vx += (target - vx) * (onGround ? 0.35 : 0.18) * (dt * 60);
      if (!left && !right && onGround) vx *= AIR;

      if (jumpQueued.current) {
        jumpQueued.current = false;
        if (jumpsLeft > 0) {
          vy = -JUMP;
          jumpsLeft -= 1;
          onGround = false;
        }
      }
      if (dashQueued.current) {
        dashQueued.current = false;
        if (canDash && dashCool <= 0) {
          dashLeft = DASH_TIME;
          dashCool = 0.9;
        }
      }
      dashCool = Math.max(0, dashCool - dt);

      // ---- physics
      if (dashLeft > 0) {
        dashLeft -= dt;
        vx = (left ? -1 : 1) * DASH_SPEED;
        vy = Math.min(vy, 60);
      } else {
        vy += GRAVITY * dt;
      }

      // horizontal
      x += vx * dt;
      for (const sd of solids) {
        if (hit(x, y, PW, PH, sd)) {
          if (vx > 0) x = sd.x - PW;
          else if (vx < 0) x = sd.x + sd.w;
          vx = 0;
        }
      }
      if (x < 0) x = 0;

      // vertical
      y += vy * dt;
      onGround = false;
      for (const sd of solids) {
        if (hit(x, y, PW, PH, sd)) {
          if (vy > 0) {
            y = sd.y - PH;
            vy = 0;
            onGround = true;
            jumpsLeft = canDouble ? 2 : 1;
          } else if (vy < 0) {
            y = sd.y + sd.h;
            vy = 40;
          }
        }
      }

      // pads
      for (const pad of level.pads ?? []) {
        if (hit(x, y, PW, PH, { x: pad.x, y: pad.y, w: 40, h: 14 })) {
          vy = -JUMP * 1.42;
          jumpsLeft = canDouble ? 1 : 0;
          shake = 6;
        }
      }

      // movers
      for (const m of movers) {
        m.t += dt * (m.speed / m.range);
        m.x = m.cx + Math.sin(m.t) * (m.range / 2);
        if (hit(x, y, PW, PH, m)) return die();
      }

      // spikes
      for (const sp of level.spikes) {
        if (hit(x + 3, y + 3, PW - 6, PH - 4, sp)) return die();
      }

      // shards
      for (const sh of shards) {
        if (!sh.got && hit(x, y, PW, PH, { x: sh.x - 12, y: sh.y - 12, w: 24, h: 24 })) {
          sh.got = true;
          collected += 1;
          shake = 3;
          cbs.current.onShards?.(collected);
        }
      }

      // pit / goal
      if (y > VIEW_H + 60) return die();
      if (x + PW >= level.goalX) return win();

      // ---- camera
      const want = Math.max(0, Math.min(level.width - VIEW_W, x - VIEW_W * 0.38));
      cam += (want - cam) * Math.min(1, dt * 8);
      shake = Math.max(0, shake - dt * 30);

      trail.unshift({ x, y, a: 1 });
      if (trail.length > 10) trail.pop();

      // ---- draw
      frame += 1;
      const sx = shake ? (Math.random() - 0.5) * shake : 0;
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, "#070c18");
      grad.addColorStop(1, "#0c1526");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // parallax stars
      ctx.fillStyle = "rgba(120,220,220,0.35)";
      for (let i = 0; i < 60; i++) {
        const px = ((i * 197 - cam * 0.25) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40);
        const py = (i * 83) % VIEW_H;
        ctx.fillRect(px, py, 2, 2);
      }

      ctx.translate(-cam + sx, 0);

      // goal beam
      const goalGrad = ctx.createLinearGradient(level.goalX, 0, level.goalX + 60, 0);
      goalGrad.addColorStop(0, "rgba(255,206,120,0.55)");
      goalGrad.addColorStop(1, "rgba(255,206,120,0)");
      ctx.fillStyle = goalGrad;
      ctx.fillRect(level.goalX, 0, 60, VIEW_H);
      ctx.fillStyle = "#ffce78";
      ctx.fillRect(level.goalX - 4, 0, 5, VIEW_H);

      // solids
      for (const sd of solids) {
        if (sd.x + sd.w < cam - 40 || sd.x > cam + VIEW_W + 40) continue;
        ctx.fillStyle = "#16283c";
        ctx.fillRect(sd.x, sd.y, sd.w, sd.h);
        ctx.fillStyle = "rgba(90,225,215,0.75)";
        ctx.fillRect(sd.x, sd.y, sd.w, 3);
      }

      // pads
      for (const pad of level.pads ?? []) {
        ctx.fillStyle = "#ffce78";
        ctx.fillRect(pad.x, pad.y, 40, 10);
      }

      // movers
      for (const m of movers) {
        ctx.save();
        ctx.translate(m.x + m.w / 2, m.y + m.h / 2);
        ctx.rotate(frame * 0.15);
        ctx.fillStyle = "#ff6b7d";
        ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h);
        ctx.restore();
      }

      // spikes
      ctx.fillStyle = "#ff5c72";
      for (const sp of level.spikes) {
        if (sp.x + sp.w < cam - 40 || sp.x > cam + VIEW_W + 40) continue;
        const count = Math.max(1, Math.round(sp.w / 26));
        const step = sp.w / count;
        for (let i = 0; i < count; i++) {
          ctx.beginPath();
          ctx.moveTo(sp.x + i * step, sp.y + sp.h);
          ctx.lineTo(sp.x + i * step + step / 2, sp.y);
          ctx.lineTo(sp.x + (i + 1) * step, sp.y + sp.h);
          ctx.closePath();
          ctx.fill();
        }
      }

      // shards
      for (const sh of shards) {
        if (sh.got) continue;
        const bob = Math.sin(frame * 0.08 + sh.x) * 4;
        ctx.save();
        ctx.translate(sh.x, sh.y + bob);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#8ff0e4";
        ctx.shadowColor = "#8ff0e4";
        ctx.shadowBlur = 14;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
      }

      // trail + player
      trail.forEach((t, i) => {
        ctx.fillStyle = `rgba(143,240,228,${0.16 * (1 - i / trail.length)})`;
        ctx.fillRect(t.x, t.y, PW, PH);
      });
      ctx.fillStyle = dashLeft > 0 ? "#ffce78" : "#e8fbf8";
      ctx.shadowColor = dashLeft > 0 ? "#ffce78" : "#5ae1d7";
      ctx.shadowBlur = 16;
      ctx.fillRect(x, y, PW, PH);
      ctx.shadowBlur = 0;
      ctx.restore();

      if (frame % 6 === 0) {
        setHud({ shards: collected, ms: Math.round(now - started) });
      }
      raf = requestAnimationFrame(tick);
    };

    let raf = requestAnimationFrame(tick);

    const down = (e: KeyboardEvent) => {
      if ([" ", "ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(e.key)) e.preventDefault();
      keys.current[e.key] = true;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") jumpQueued.current = true;
      if (e.key === "Shift") dashQueued.current = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      done = true;
    };
  }, [level, running]);

  const held = (key: string, on: boolean) => {
    keys.current[key] = on;
  };

  return (
    <div className="w-full">
      <div className="text-muted-foreground mb-2 flex items-center justify-between font-mono text-[11px]">
        <span>
          Level {level.n} · {level.name}
        </span>
        <span>
          shards {hud.shards}/{level.shards.length} · {(hud.ms / 1000).toFixed(1)}s · par{" "}
          {(level.parMs / 1000).toFixed(0)}s
        </span>
      </div>
      <canvas
        ref={canvas}
        width={VIEW_W}
        height={VIEW_H}
        className="border-border bg-background w-full rounded-xl border"
        style={{ touchAction: "none", imageRendering: "pixelated" }}
        onPointerDown={() => (jumpQueued.current = true)}
      />
      {/* Touch controls */}
      <div className="mt-3 flex gap-2 sm:hidden">
        <button
          type="button"
          className="border-border bg-secondary/50 flex-1 rounded-lg border py-3 text-sm"
          onPointerDown={() => held("ArrowLeft", true)}
          onPointerUp={() => held("ArrowLeft", false)}
          onPointerLeave={() => held("ArrowLeft", false)}
        >
          ←
        </button>
        <button
          type="button"
          className="border-primary/40 bg-primary/15 flex-1 rounded-lg border py-3 text-sm"
          onPointerDown={() => (jumpQueued.current = true)}
        >
          Jump
        </button>
        <button
          type="button"
          className="border-border bg-secondary/50 flex-1 rounded-lg border py-3 text-sm"
          onPointerDown={() => held("ArrowRight", true)}
          onPointerUp={() => held("ArrowRight", false)}
          onPointerLeave={() => held("ArrowRight", false)}
        >
          →
        </button>
      </div>
    </div>
  );
}
