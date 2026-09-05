/** Headless beam-search solver for Pulse Rush levels. Mirrors PulseRush.tsx step(). */
import {
  U, CUBE, FLOOR, ROOF, BASE_SPEED, SPEED_STEPS, GRAVITY, JUMP_V,
  buildLevel, LEVELS, type Obj,
} from "../src/lib/pulse";

const half = CUBE / 2;
const DT = 1000 / 60;

type S = {
  x: number; y: number; vy: number; grav: 1 | -1; speed: number;
  mode: "cube" | "ship" | "ball" | "wave"; onSurface: boolean; flipCd: number;
  usedOrbs: Set<Obj>; dead: boolean;
};

function clone(s: S): S {
  return { ...s, usedOrbs: new Set(s.usedOrbs) };
}

function step(s: S, objects: Obj[], held: boolean, tapped: boolean) {
  if (s.dead) return;
  if (s.flipCd > 0) s.flipCd -= DT;
  s.x += BASE_SPEED * s.speed * DT;
  const prevTop = s.y - half;
  const prevBot = s.y + half;

  if (s.mode === "cube" || s.mode === "ball") {
    if (s.mode === "cube") {
      if ((tapped || held) && s.onSurface) { s.vy = -s.grav * JUMP_V; s.onSurface = false; }
    } else if (tapped && s.onSurface && s.flipCd <= 0) {
      s.grav = s.grav === 1 ? -1 : 1; s.flipCd = 120; s.onSurface = false;
    }
    s.vy += s.grav * GRAVITY * DT;
    s.vy = Math.max(-1.2, Math.min(1.2, s.vy));
  } else if (s.mode === "ship") {
    const up = held ? -1 : 1;
    s.vy += s.grav * up * (held ? 0.0019 : 0.0016) * DT;
    s.vy = Math.max(-0.44, Math.min(0.44, s.vy));
  } else {
    s.vy = (held ? -1 : 1) * s.grav * BASE_SPEED * s.speed;
  }

  s.y += s.vy * DT;
  s.onSurface = false;

  if (s.y + half > FLOOR) {
    s.y = FLOOR - half;
    if (s.grav === 1) { s.vy = 0; s.onSurface = true; }
    else if (s.mode === "cube" || s.mode === "ball") { s.dead = true; return; }
    else s.vy = 0;
  }
  if (s.y - half < ROOF) {
    s.y = ROOF + half;
    if (s.grav === -1) { s.vy = 0; s.onSurface = true; }
    else s.vy = 0;
  }

  const lo = s.x - 3 * U;
  const hi = s.x + 3 * U;
  for (const o of objects) {
    const ox = o.x * U;
    if (ox < lo - 4 * U) continue;
    if (ox > hi + 4 * U) break;
    if (o.t === "block") {
      const l = o.x * U, r = (o.x + o.w) * U;
      const t = FLOOR - (o.y + o.h) * U, b = FLOOR - o.y * U;
      if (s.x + half > l && s.x - half < r && s.y + half > t && s.y - half < b) {
        if (s.mode === "wave") { s.dead = true; return; }
        if (s.vy >= 0 && prevBot <= t + 6) {
          s.y = t - half; s.vy = 0; s.onSurface = s.grav === 1;
          if (s.grav === -1) { s.dead = true; return; }
        } else if (s.vy <= 0 && prevTop >= b - 6) {
          s.y = b + half; s.vy = 0; s.onSurface = s.grav === -1;
        } else { s.dead = true; return; }
      }
    } else if (o.t === "spike") {
      const cx = o.x * U + U / 2;
      const baseY = o.up ? FLOOR - o.y * U : ROOF + o.y * U;
      const tipY = o.up ? baseY - U : baseY + U;
      const hx = 0.3 * U;
      const loY = Math.min(baseY, tipY) + 4;
      const hiY = Math.max(baseY, tipY) - 4;
      if (s.x + half * 0.7 > cx - hx && s.x - half * 0.7 < cx + hx &&
          s.y + half * 0.7 > loY && s.y - half * 0.7 < hiY) { s.dead = true; return; }
    } else if (o.t === "saw") {
      const cx = o.x * U + U / 2, cy = FLOOR - o.y * U, rr = o.r * U * 0.78;
      if (Math.hypot(s.x - cx, s.y - cy) < rr + half * 0.55) { s.dead = true; return; }
    } else if (o.t === "pad") {
      const cx = o.x * U + U / 2, cy = FLOOR - o.y * U;
      if (Math.abs(s.x - cx) < U * 0.7 && Math.abs(s.y + half - cy) < 14) {
        s.vy = -s.grav * JUMP_V * 1.35; s.onSurface = false;
      }
    } else if (o.t === "orb") {
      const cx = o.x * U + U / 2, cy = FLOOR - o.y * U;
      if (tapped && !s.usedOrbs.has(o) && Math.hypot(s.x - cx, s.y - cy) < U * 1.3) {
        s.usedOrbs.add(o); s.vy = -s.grav * JUMP_V * 1.05; s.onSurface = false;
      }
    } else if (o.t === "portal") {
      if (Math.abs(s.x - ox) < 8 && s.mode !== o.mode) { s.mode = o.mode; if (s.mode === "wave") s.vy = 0; }
    } else if (o.t === "gravity") {
      if (Math.abs(s.x - ox) < 8 && s.grav !== o.dir) s.grav = o.dir;
    } else if (o.t === "speed") {
      if (Math.abs(s.x - ox) < 8) s.speed = SPEED_STEPS[Math.max(0, Math.min(4, o.step))]!;
    }
  }
}

function solve(n: number) {
  const def = LEVELS.find((l) => l.n === n)!;
  const built = buildLevel(def);
  const objects = built.objects;
  const goal = built.length * U;
  const start: S = {
    x: 0, y: FLOOR - half, vy: 0, grav: 1, speed: SPEED_STEPS[1]!,
    mode: "cube", onSurface: true, flipCd: 0, usedOrbs: new Set(), dead: false,
  };
  let beam: { s: S; prevHeld: boolean }[] = [{ s: start, prevHeld: false }];
  const WIDTH = 900;
  for (let frame = 0; frame < 20000; frame++) {
    const next: { s: S; prevHeld: boolean }[] = [];
    for (const b of beam) {
      for (const held of [false, true]) {
        const c = clone(b.s);
        step(c, objects, held, held && !b.prevHeld);
        if (!c.dead) next.push({ s: c, prevHeld: held });
      }
    }
    if (!next.length) return { ok: false, frame, best: Math.max(...beam.map((b) => b.s.x)) / goal };
    const done = next.find((b) => b.s.x >= goal);
    if (done) return { ok: true, frames: frame };
    next.sort((a, b) => b.s.x - a.s.x);
    const seen = new Set<string>();
    beam = [];
    for (const c of next) {
      const k = `${Math.round(c.s.x / 6)}|${Math.round(c.s.y / 5)}|${Math.round(c.s.vy * 25)}|${c.s.grav}|${c.s.mode}|${c.s.speed}|${c.prevHeld}`;
      if (seen.has(k)) continue;
      seen.add(k);
      beam.push(c);
      if (beam.length >= WIDTH) break;
    }
  }
  return { ok: false, frame: -1, best: 0 };
}

const args = process.argv.slice(2).map(Number);
const list = args.length ? args : LEVELS.map((l) => l.n);
for (const n of list) {
  const r = solve(n);
  console.log(`level ${n}: ${r.ok ? "CLEARABLE" : `FAILED at ${(((r as any).best ?? 0) * 100).toFixed(1)}%`}`);
}
