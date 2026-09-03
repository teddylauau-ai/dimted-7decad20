import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_SPEED,
  CUBE,
  FLOOR,
  GRAVITY,
  JUMP_V,
  ROOF,
  SPEED_STEPS,
  U,
  VIEW_H,
  VIEW_W,
  buildLevel,
  colorPair,
  type LevelDef,
  type Mode,
  type Obj,
} from "@/lib/pulse";
import {
  deathStyle,
  drawBall,
  drawCube,
  drawDeathParticle,
  drawShip,
  drawTrailParticle,
  drawWave,
  trailStyle,
} from "@/lib/pulse-skins";

/**
 * Pulse Rush engine — a one-button rhythm runner. You always move forward; the
 * only input is hold/tap. Death is instant and so is the restart, so the loop
 * is: attempt, learn a metre more of the level, attempt again.
 */

export type PulseSkins = {
  icon: string;
  ship: string;
  ball: string;
  wave: string;
  trail: string;
  death: string;
  colors: string;
};

export type PulseRunEnd = {
  cleared: boolean;
  pct: number;
  ms: number;
  coinMask: number;
  attempts: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot?: number;
};

type Snapshot = {
  x: number;
  y: number;
  vy: number;
  mode: Mode;
  grav: 1 | -1;
  speed: number;
  coinMask: number;
};

export function PulseRush({
  level,
  skins,
  practice,
  onEnd,
  quitRef,
}: {
  level: LevelDef;
  skins: PulseSkins;
  practice: boolean;
  onEnd: (r: PulseRunEnd) => void;
  /** Parent fills this in so its own Quit button can end the session cleanly. */
  quitRef?: { current: () => void };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  const [hud, setHud] = useState({ pct: 0, best: 0, attempts: 1, coins: [false, false, false], checkpoints: 0 });
  const [outcome, setOutcome] = useState<"running" | "dead" | "cleared">("running");
  const restartRef = useRef<() => void>(() => {});
  const checkpointRef = useRef<{ place: () => void; remove: () => void }>({
    place: () => {},
    remove: () => {},
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const ctx: CanvasRenderingContext2D = c;

    const built = buildLevel(level);
    const objects = built.objects.slice().sort((a, b) => a.x - b.x);
    const goal = built.length * U;
    const pal = level.palette;
    const pair = colorPair(skins.colors);
    const trail = trailStyle(skins.trail);
    const death = deathStyle(skins.death);

    /* -------------------------------------------------------------- run state */

    let x = 0;
    let y = FLOOR - CUBE / 2;
    let vy = 0;
    let mode: Mode = "cube";
    let grav: 1 | -1 = 1;
    let speed: number = SPEED_STEPS[1]!;
    let onSurface = true;
    let rot = 0;
    let coinMask = 0;
    let elapsed = 0;
    let attempts = 1;
    let best = 0;
    let dead = false;
    let cleared = false;
    let flipCd = 0;
    let flash = 0;
    /** Death shake, in pixels, decaying every frame. */
    let shake = 0;
    /** Death shockwave ring, 0..1, only for the loud death effects. */
    let shockwave = 0;
    let shockAt = { x: 0, y: 0 };
    /** Smoothed vertical camera offset — the view follows you up, like GD. */
    let camY = 0;

    let held = false;
    let tapped = false;
    const usedOrbs = new Set<Obj>();
    const takenCoins = new Set<Obj>();
    const parts: Particle[] = [];
    const deathParts: Particle[] = [];
    const checkpoints: Snapshot[] = [];

    const snapshot = (): Snapshot => ({ x, y, vy, mode, grav, speed, coinMask });

    const restore = (s: Snapshot | null) => {
      if (s) {
        x = s.x;
        y = s.y;
        vy = s.vy;
        mode = s.mode;
        grav = s.grav;
        speed = s.speed;
        coinMask = s.coinMask;
      } else {
        x = 0;
        y = FLOOR - CUBE / 2;
        vy = 0;
        mode = "cube";
        grav = 1;
        speed = SPEED_STEPS[1]!;
        coinMask = 0;
        usedOrbs.clear();
        takenCoins.clear();
      }
      onSurface = true;
      rot = 0;
      shake = 0;
      shockwave = 0;
      camY = 0;
      elapsed = 0;
      parts.length = 0;
      deathParts.length = 0;
      dead = false;
      cleared = false;
      setOutcome("running");
    };

    const restart = () => {
      attempts += 1;
      restore(practice && checkpoints.length ? checkpoints[checkpoints.length - 1]! : null);
    };
    restartRef.current = restart;
    const quit = () => {
      endRef.current({
        cleared: false,
        pct: Math.max(best, pct()),
        ms: elapsed,
        coinMask,
        attempts,
      });
    };
    if (quitRef) quitRef.current = quit;
    checkpointRef.current = {
      place: () => {
        if (!practice || dead || cleared) return;
        checkpoints.push(snapshot());
        setHud((h) => ({ ...h, checkpoints: checkpoints.length }));
      },
      remove: () => {
        checkpoints.pop();
        setHud((h) => ({ ...h, checkpoints: checkpoints.length }));
      },
    };

    /* ----------------------------------------------------------------- inputs */

    const isJumpKey = (k: string) => k === " " || k === "ArrowUp" || k === "w" || k === "Enter";

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (isJumpKey(k)) {
        e.preventDefault();
        if (!held) tapped = true;
        held = true;
        if (dead || cleared) restart();
      }
      if (k === "z" && practice) checkpointRef.current.place();
      if (k === "x" && practice) checkpointRef.current.remove();
      if (k === "r") restart();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (isJumpKey(k)) held = false;
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      if (!held) tapped = true;
      held = true;
      if (dead || cleared) restart();
    };
    const onUp = () => {
      held = false;
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    /* ---------------------------------------------------------------- helpers */

    const half = CUBE / 2;
    const topOf = (o: Extract<Obj, { t: "block" }>) => FLOOR - (o.y + o.h) * U;
    const botOf = (o: Extract<Obj, { t: "block" }>) => FLOOR - o.y * U;

    function die() {
      if (dead || cleared) return;
      dead = true;
      flash = death.flash;
      shake = death.shake;
      shockwave = death.shockwave ? 1 : 0;
      shockAt = { x, y };
      const n = death.count;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / Math.max(1, n) + Math.random() * 0.4;
        const sp = (death.inward ? -1 : 1) * death.speed * (0.5 + Math.random() * 0.8);
        const dist = death.inward ? CUBE * 1.9 : 0;
        deathParts.push({
          x: x + Math.cos(a) * dist,
          y: y + Math.sin(a) * dist,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: death.life,
          max: death.life,
          size: death.size * (0.7 + Math.random() * 0.7),
          rot: a,
        });
      }
      best = Math.max(best, pct());
      setOutcome("dead");
      window.setTimeout(() => {
        if (!disposed && dead) restart();
      }, 420);
    }

    function finish() {
      if (cleared || dead) return;
      cleared = true;
      best = 100;
      setOutcome("cleared");
      endRef.current({ cleared: true, pct: 100, ms: elapsed, coinMask, attempts });
    }

    const pct = () => Math.max(0, Math.min(100, (x / goal) * 100));

    function jump() {
      vy = -grav * JUMP_V;
      onSurface = false;
      // Every trail gets a little kick on takeoff; fracture gets a big one.
      const burst = skins.trail === "trail-fracture" ? 8 : 3;
      for (let i = 0; i < burst; i++)
        parts.push({
          x,
          y,
          vx: -0.1 - Math.random() * 0.1,
          vy: (Math.random() - 0.5) * 0.3,
          life: trail.life * 0.7,
          max: trail.life * 0.7,
          size: trail.size,
        });
    }

    /* -------------------------------------------------------------- physics */

    function step(dt: number) {
      if (dead || cleared) {
        for (const p of deathParts) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
        }
        return;
      }

      elapsed += dt;
      if (flipCd > 0) flipCd -= dt;
      x += BASE_SPEED * speed * dt;

      const prevTop = y - half;
      const prevBot = y + half;

      // vertical motion per mode
      if (mode === "cube" || mode === "ball") {
        if (mode === "cube") {
          if (tapped || held) {
            if (onSurface) jump();
          }
        } else if (tapped && onSurface && flipCd <= 0) {
          grav = grav === 1 ? -1 : 1;
          flipCd = 120;
          onSurface = false;
        }
        vy += grav * GRAVITY * dt;
        vy = Math.max(-1.2, Math.min(1.2, vy));
        if (onSurface) {
          // Snap flat on landing, the way a Geometry Dash cube does.
          const target = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
          rot += (target - rot) * Math.min(1, dt * 0.03);
        } else {
          rot = (rot + grav * dt * 0.0125) % (Math.PI * 2);
        }
      } else if (mode === "ship") {
        const up = held ? -1 : 1;
        vy += grav * up * (held ? 0.0019 : 0.0016) * dt;
        vy = Math.max(-0.44, Math.min(0.44, vy));
        rot = vy * 1.2;
      } else {
        // wave: pure 45 degrees
        vy = (held ? -1 : 1) * grav * BASE_SPEED * speed;
        rot = 0;
      }

      y += vy * dt;
      onSurface = false;

      // floor / roof
      if (y + half > FLOOR) {
        y = FLOOR - half;
        if (grav === 1) {
          vy = 0;
          onSurface = true;
        } else if (mode === "cube" || mode === "ball") {
          die();
          return;
        } else {
          vy = 0;
        }
      }
      if (y - half < ROOF) {
        y = ROOF + half;
        if (grav === -1) {
          vy = 0;
          onSurface = true;
        } else if (mode === "cube" || mode === "ball") {
          vy = 0;
        } else {
          vy = 0;
        }
      }

      // objects near the player
      const lo = x - 3 * U;
      const hi = x + 3 * U;
      for (const o of objects) {
        const ox = o.x * U;
        if (ox < lo - 4 * U) continue;
        if (ox > hi + 4 * U) break;

        if (o.t === "block") {
          const l = o.x * U;
          const r = (o.x + o.w) * U;
          const t = topOf(o);
          const b = botOf(o);
          if (x + half > l && x - half < r && y + half > t && y - half < b) {
            if (mode === "wave") {
              die();
              return;
            }
            if (vy >= 0 && prevBot <= t + 6) {
              y = t - half;
              vy = 0;
              onSurface = grav === 1;
              if (grav === -1) {
                die();
                return;
              }
            } else if (vy <= 0 && prevTop >= b - 6) {
              y = b + half;
              vy = 0;
              onSurface = grav === -1;
              if (grav === 1 && mode === "cube") vy = 0;
            } else {
              die();
              return;
            }
          }
        } else if (o.t === "spike") {
          const cx = o.x * U + U / 2;
          const baseY = o.up ? FLOOR - o.y * U : ROOF + o.y * U;
          const tipY = o.up ? baseY - U : baseY + U;
          const hx = 0.3 * U;
          const loY = Math.min(baseY, tipY) + 4;
          const hiY = Math.max(baseY, tipY) - 4;
          if (
            x + half * 0.7 > cx - hx &&
            x - half * 0.7 < cx + hx &&
            y + half * 0.7 > loY &&
            y - half * 0.7 < hiY
          ) {
            die();
            return;
          }
        } else if (o.t === "saw") {
          const cx = o.x * U + U / 2;
          const cy = FLOOR - o.y * U;
          const rr = o.r * U * 0.78;
          if (Math.hypot(x - cx, y - cy) < rr + half * 0.55) {
            die();
            return;
          }
        } else if (o.t === "pad") {
          const cx = o.x * U + U / 2;
          const cy = FLOOR - o.y * U;
          if (Math.abs(x - cx) < U * 0.7 && Math.abs(y + half - cy) < 14) {
            vy = -grav * JUMP_V * 1.35;
            onSurface = false;
          }
        } else if (o.t === "orb") {
          const cx = o.x * U + U / 2;
          const cy = FLOOR - o.y * U;
          if (tapped && !usedOrbs.has(o) && Math.hypot(x - cx, y - cy) < U * 1.3) {
            usedOrbs.add(o);
            vy = -grav * JUMP_V * 1.05;
            onSurface = false;
          }
        } else if (o.t === "coin") {
          const cx = o.x * U + U / 2;
          const cy = FLOOR - o.y * U;
          if (!takenCoins.has(o) && Math.hypot(x - cx, y - cy) < U * 0.95) {
            takenCoins.add(o);
            coinMask |= 1 << o.i;
            for (let i = 0; i < 12; i++)
              parts.push({
                x: cx,
                y: cy,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: 420,
                max: 420,
                size: 3,
              });
          }
        } else if (o.t === "portal") {
          if (Math.abs(x - ox) < 8 && mode !== o.mode) {
            mode = o.mode;
            if (mode === "wave") vy = 0;
          }
        } else if (o.t === "gravity") {
          if (Math.abs(x - ox) < 8 && grav !== o.dir) grav = o.dir;
        } else if (o.t === "speed") {
          if (Math.abs(x - ox) < 8) speed = SPEED_STEPS[Math.max(0, Math.min(4, o.step))]!;
        }
      }

      // trail
      for (let i = 0; i < trail.density; i++)
        parts.push({
          x: x - half,
          y: y + (Math.random() - 0.5) * CUBE * 0.6,
          vx: -0.02,
          vy: (Math.random() - 0.5) * 0.05,
          life: trail.life,
          max: trail.life,
          size: trail.size * (0.75 + Math.random() * 0.5),
        });
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      while (parts.length && parts[0]!.life <= 0) parts.shift();

      tapped = false;

      if (x >= goal) finish();
    }

    /* ---------------------------------------------------------------- render */

    function drawSpike(camX: number, o: Extract<Obj, { t: "spike" }>) {
      const cx = o.x * U + U / 2 - camX;
      const baseY = o.up ? FLOOR - o.y * U : ROOF + o.y * U;
      const tipY = o.up ? baseY - U : baseY + U;
      ctx.beginPath();
      ctx.moveTo(cx - U * 0.5, baseY);
      ctx.lineTo(cx + U * 0.5, baseY);
      ctx.lineTo(cx, tipY);
      ctx.closePath();
      ctx.fillStyle = pal.solid;
      ctx.fill();
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function render(now: number) {
      // Beat clock from the level BPM — everything breathes on the downbeat.
      const beat = (now / (60000 / level.bpm)) % 1;
      const pulse = Math.pow(1 - beat, 3);

      ctx.save();
      if (shake > 0.4) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.86;
      } else shake = 0;

      // background
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, pal.bgA);
      grad.addColorStop(1, pal.bgB);
      ctx.fillStyle = grad;
      ctx.fillRect(-40, -40, VIEW_W + 80, VIEW_H + 80);
      ctx.fillStyle = `rgba(255,255,255,${0.035 * pulse})`;
      ctx.fillRect(-40, -40, VIEW_W + 80, VIEW_H + 80);

      const camX = Math.max(0, x - VIEW_W * 0.32);
      // Follow the player upward once they climb past the lower third.
      const wantY = Math.max(0, FLOOR - 140 - y);
      camY += (wantY - camY) * 0.08;
      ctx.translate(0, camY);

      // parallax grid
      ctx.strokeStyle = `rgba(255,255,255,${0.045 + 0.05 * pulse})`;
      ctx.lineWidth = 1;
      const gs = U * 2;
      const off = (camX * 0.4) % gs;
      for (let gx = -off; gx < VIEW_W; gx += gs) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, VIEW_H);
        ctx.stroke();
      }
      for (let gy = ROOF; gy < FLOOR; gy += gs) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(VIEW_W, gy);
        ctx.stroke();
      }

      // roof + floor
      ctx.fillStyle = pal.ground;
      ctx.fillRect(0, FLOOR, VIEW_W, VIEW_H - FLOOR + 80);
      ctx.fillRect(0, -80, VIEW_W, ROOF + 80);
      // Ground stripes scroll past so speed is readable at a glance.
      ctx.strokeStyle = pal.edge + "22";
      ctx.lineWidth = 2;
      const stripe = U * 2;
      for (let sx = -(camX % stripe); sx < VIEW_W; sx += stripe) {
        ctx.beginPath();
        ctx.moveTo(sx, FLOOR + 4);
        ctx.lineTo(sx - 26, VIEW_H + 40);
        ctx.stroke();
      }
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR);
      ctx.lineTo(VIEW_W, FLOOR);
      ctx.moveTo(0, ROOF);
      ctx.lineTo(VIEW_W, ROOF);
      ctx.stroke();

      // objects
      for (const o of objects) {
        const ox = o.x * U - camX;
        if (ox < -6 * U) continue;
        if (ox > VIEW_W + 6 * U) break;

        if (o.t === "block") {
          const t = topOf(o);
          ctx.fillStyle = pal.solid;
          ctx.fillRect(ox, t, o.w * U, o.h * U);
          ctx.strokeStyle = pal.edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, t, o.w * U, o.h * U);
        } else if (o.t === "spike") {
          drawSpike(camX, o);
        } else if (o.t === "saw") {
          const cx = ox + U / 2;
          const cy = FLOOR - o.y * U;
          const rr = o.r * U;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((now / 160) % (Math.PI * 2));
          ctx.fillStyle = pal.solid;
          ctx.strokeStyle = pal.edge;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 * i) / 8;
            const r2 = i % 2 === 0 ? rr : rr * 0.62;
            ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (o.t === "pad") {
          const cy = FLOOR - o.y * U;
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(ox + 2, cy - 6, U - 4, 6);
        } else if (o.t === "orb") {
          const cx = ox + U / 2;
          const cy = FLOOR - o.y * U;
          ctx.beginPath();
          ctx.arc(cx, cy, U * 0.42 + Math.sin(now / 220) * 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(251,191,36,0.22)";
          ctx.fill();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (o.t === "coin") {
          if (takenCoins.has(o)) continue;
          const cx = ox + U / 2;
          const cy = FLOOR - o.y * U;
          const wob = Math.sin(now / 260) * 3;
          ctx.beginPath();
          ctx.arc(cx, cy + wob, U * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(251,191,36,0.9)";
          ctx.fill();
          ctx.strokeStyle = "#fde68a";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (o.t === "portal" || o.t === "gravity" || o.t === "speed") {
          const color =
            o.t === "speed" ? "#34d399" : o.t === "gravity" ? "#60a5fa" : portalColor(o.mode);
          ctx.fillStyle = color + "33";
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + U / 2, (FLOOR + ROOF) / 2, U * 0.35, (FLOOR - ROOF) / 2 - 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // trail
      if (trail.glow) {
        ctx.shadowColor = pair.primary;
        ctx.shadowBlur = trail.glow;
      }
      for (const p of parts) {
        const a = Math.max(0, p.life / p.max);
        ctx.fillStyle = trail.dual ? (a > 0.5 ? pair.primary : pair.secondary) : pair.primary;
        drawTrailParticle(ctx, trail, p.x - camX, p.y, p.size, a * 0.85);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // player
      if (!dead) {
        ctx.save();
        ctx.translate(x - camX, y);
        if (mode === "cube") ctx.rotate(rot);
        else if (mode === "ship") ctx.rotate(rot);
        else if (mode === "wave") ctx.rotate(held ? -0.7 * grav : 0.7 * grav);
        ctx.shadowColor = pair.primary;
        ctx.shadowBlur = 18;
        ctx.fillStyle = pair.primary;
        ctx.strokeStyle = pair.secondary;
        ctx.lineWidth = 3;
        const sk = { ctx, half, pair, now };
        if (mode === "ball") drawBall(skins.ball, sk);
        else if (mode === "ship") drawShip(skins.ship, sk);
        else if (mode === "wave") drawWave(skins.wave, sk);
        else drawCube(skins.icon, sk);
        ctx.restore();
        ctx.shadowBlur = 0;
      }

      // death particles
      if (shockwave > 0) {
        ctx.strokeStyle = pair.primary + "aa";
        ctx.lineWidth = 4 * shockwave;
        ctx.beginPath();
        ctx.arc(shockAt.x - camX, shockAt.y, (1 - shockwave) * 190, 0, Math.PI * 2);
        ctx.stroke();
        shockwave = Math.max(0, shockwave - 0.045);
      }
      for (const p of deathParts) {
        const a = Math.max(0, p.life / p.max);
        ctx.fillStyle = a > 0.6 ? pair.primary : pair.secondary;
        drawDeathParticle(ctx, death, p.x - camX, p.y, p.size, a, (p.rot ?? 0) + (1 - a) * 4);
      }
      ctx.globalAlpha = 1;

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        flash = Math.max(0, flash - 0.08);
      }

      // practice checkpoints
      if (practice) {
        ctx.fillStyle = "rgba(94,234,212,0.85)";
        for (const cp of checkpoints) {
          const cx = cp.x - camX;
          if (cx < -20 || cx > VIEW_W + 20) continue;
          ctx.fillRect(cx - 2, ROOF, 4, FLOOR - ROOF);
        }
      }

      // finish gate
      const gx = goal - camX;
      if (gx < VIEW_W + 40) {
        ctx.fillStyle = "rgba(251,191,36,0.16)";
        ctx.fillRect(gx, ROOF, 20, FLOOR - ROOF);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.strokeRect(gx, ROOF, 20, FLOOR - ROOF);
      }

      ctx.restore();
    }

    function portalColor(m: Mode) {
      return m === "ship" ? "#f472b6" : m === "ball" ? "#f59e0b" : m === "wave" ? "#22d3ee" : "#a3e635";
    }

    /* ------------------------------------------------------------------ loop */

    let disposed = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;

    const frame = (now: number) => {
      if (disposed) return;
      const delta = Math.min(48, now - last);
      last = now;
      acc += delta;
      while (acc >= 4) {
        step(4);
        acc -= 4;
      }
      render(now);
      if (now - hudAt > 60) {
        hudAt = now;
        const p = pct();
        setHud({
          pct: p,
          best: Math.max(best, p),
          attempts,
          coins: [(coinMask & 1) > 0, (coinMask & 2) > 0, (coinMask & 4) > 0],
          checkpoints: checkpoints.length,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Dev-only inspection hook so the level geometry can be verified headlessly.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>)["__pulse"] = () => ({
        x,
        y,
        vy,
        mode,
        grav,
        speed,
        onSurface,
        dead,
        cleared,
        pct: pct(),
        goal,
        objects,
      });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    level,
    practice,
    skins.colors,
    skins.trail,
    skins.death,
    skins.icon,
    skins.ship,
    skins.ball,
    skins.wave,
    quitRef,
  ]);

  const restart = useCallback(() => restartRef.current(), []);

  return (
    <div className="w-full">
      {/* HUD sits above the canvas so nothing ever covers the play area */}
      <div className="mb-2 flex items-center gap-3">
        <div className="bg-secondary/60 relative h-3 flex-1 overflow-hidden rounded-full">
          <div
            className="from-primary to-accent absolute inset-y-0 left-0 bg-gradient-to-r transition-[width] duration-75"
            style={{ width: `${hud.pct}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-white/40"
            style={{ left: `${hud.best}%` }}
            title="Best"
          />
        </div>
        <span className="text-foreground w-14 text-right font-mono text-sm tabular-nums">
          {Math.floor(hud.pct)}%
        </span>
        <span className="text-muted-foreground font-mono text-xs">att {hud.attempts}</span>
        <span className="flex items-center gap-1">
          {hud.coins.map((got, i) => (
            <span
              key={i}
              className={
                "h-3 w-3 rounded-full border " +
                (got ? "border-amber-200 bg-amber-400" : "border-white/20 bg-white/5")
              }
            />
          ))}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="border-border w-full touch-none rounded-2xl border shadow-2xl"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      />

      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>Tap / space to jump · hold in ship &amp; wave</span>
        <span>R to restart</span>
        {practice && (
          <span className="text-primary">
            Z places a checkpoint · X removes · {hud.checkpoints} placed
          </span>
        )}
        {outcome === "cleared" && <span className="text-accent">Level complete</span>}
        <button onClick={restart} className="text-foreground/70 hover:text-foreground underline">
          Restart now
        </button>
      </div>
    </div>
  );
}
