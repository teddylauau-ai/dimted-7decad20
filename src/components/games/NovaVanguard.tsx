import { useEffect, useRef, useState } from "react";
import {
  FLOOR_Y,
  VIEW_H,
  VIEW_W,
  type GearSlug,
  type LevelDef,
  type WeaponDef,
} from "@/lib/vanguard";

/**
 * Nova Vanguard engine — canvas action platformer. Run, jump, dash and shoot
 * through one hand-built level. All progression maths lives outside; this only
 * plays the level and reports what happened.
 */

type Enemy = {
  kind: "drone" | "turret" | "walker" | "boss";
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  homeX: number;
  range: number;
  dir: number;
  t: number;
  fireAt: number;
  phase: number;
  hitFlash: number;
  dead: boolean;
};

type Bolt = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: boolean;
  homing: boolean;
  splash: number;
  life: number;
  color: string;
  hits: Set<Enemy>;
};

type EBolt = { x: number; y: number; vx: number; vy: number; life: number };
type Core = { x: number; y: number; taken: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export type VanguardRunEnd = {
  cleared: boolean;
  ms: number;
  kills: number;
  coresCollected: number;
  damageTaken: number;
};

const GRAV = 0.0017;
const PW = 22;
const PH = 30;

export function NovaVanguard({
  level,
  weapon,
  gear,
  onEnd,
}: {
  level: LevelDef;
  weapon: WeaponDef;
  gear: GearSlug | null;
  onEnd: (r: VanguardRunEnd) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  // Held in a ref so a re-rendered parent never restarts the run mid-level.
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const [hud, setHud] = useState({
    hp: 3,
    maxHp: 3,
    kills: 0,
    cores: 0,
    ms: 0,
    bossHp: 0,
    bossMax: 0,
    dashReady: true,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;

    console.log("VG mount", Date.now());
    const keys = keysRef.current;
    keys.clear();

    const maxHp = 3 + (gear === "kinetic-plate" ? 1 : 0);
    const canDash = gear === "dash-core";
    const canDouble = gear === "phase-boots";
    const magnet = gear === "magnet-field";
    const siphon = gear === "siphon-lattice";

    const P = {
      x: 60,
      y: FLOOR_Y - PH,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: 1,
      hp: maxHp,
      jumps: 0,
      invuln: 0,
      dash: 0,
      dashCd: 0,
      safeX: 60,
      jumpHeld: false,
    };

    const enemies: Enemy[] = level.enemies.map((s) => {
      const size =
        s.kind === "boss"
          ? { w: 84, h: 92 }
          : s.kind === "turret"
            ? { w: 30, h: 30 }
            : s.kind === "walker"
              ? { w: 28, h: 30 }
              : { w: 26, h: 22 };
      const hp =
        s.kind === "boss"
          ? 220 + level.n * 26
          : s.kind === "turret"
            ? 32
            : s.kind === "walker"
              ? 28
              : 20;
      return {
        kind: s.kind,
        x: s.x,
        y: s.y,
        ...size,
        hp,
        maxHp: hp,
        homeX: s.x,
        range: s.range ?? 0,
        dir: 1,
        t: Math.random() * 1000,
        fireAt: 700 + Math.random() * 900,
        phase: 1,
        hitFlash: 0,
        dead: false,
      };
    });

    const cores: Core[] = level.cores.map((c) => ({ ...c, taken: false }));
    const bolts: Bolt[] = [];
    const ebolts: EBolt[] = [];
    const parts: Particle[] = [];

    let camX = 0;
    let elapsed = 0;
    let kills = 0;
    let collected = 0;
    let damageTaken = 0;
    let shotCd = 0;
    let finished = false;
    let raf = 0;
    let last = performance.now();
    let shake = 0;

    /** Pointer aim in world space (null until the pointer is used). */
    let aim: { x: number; y: number } | null = null;
    let firing = false;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "a", "d", "w", "s", "j", "Shift"].includes(
          k,
        )
      )
        e.preventDefault();
      keys.add(k);
      if (k === "j" || k === " ") firing = k === "j" ? true : firing;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.delete(k);
      if (k === "j") firing = false;
    };
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * VIEW_W + camX,
        y: ((e.clientY - r.top) / r.height) * VIEW_H,
      };
    };
    const onMove = (e: PointerEvent) => {
      aim = toWorld(e);
    };
    const onDown = (e: PointerEvent) => {
      aim = toWorld(e);
      firing = true;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onUp = () => {
      firing = false;
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);

    /* -------------------------------------------------------------- helpers */

    const onSolidGround = (x: number) => level.ground.some((g) => x >= g.x && x <= g.x + g.w);

    function hurt(n = 1) {
      if (P.invuln > 0 || finished) return;
      P.hp -= n;
      damageTaken += n;
      P.invuln = 950;
      shake = 12;
      burst(P.x, P.y - PH / 2, "#f87171", 14);
      if (P.hp <= 0) end(false);
    }

    function burst(x: number, y: number, color: string, n = 10) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.05 + Math.random() * 0.25;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 380, color });
      }
    }

    function end(cleared: boolean) {
      if (finished) return;
      finished = true;
      endRef.current({ cleared, ms: elapsed, kills, coresCollected: collected, damageTaken });
    }

    function damageEnemy(en: Enemy, dmg: number) {
      en.hp -= dmg;
      en.hitFlash = 120;
      if (en.hp <= 0 && !en.dead) {
        en.dead = true;
        kills += 1;
        burst(en.x + en.w / 2, en.y + en.h / 2, en.kind === "boss" ? "#fbbf24" : "#5eead4", en.kind === "boss" ? 60 : 18);
        if (en.kind === "boss") shake = 24;
        if (siphon && kills % 8 === 0 && P.hp < maxHp) P.hp += 1;
      }
    }

    function fire() {
      const cx = P.x;
      const cy = P.y - PH / 2;
      let ax: number;
      let ay: number;
      if (aim) {
        ax = aim.x - cx;
        ay = aim.y - cy;
      } else {
        ax = P.facing;
        ay = keys.has("ArrowUp") || keys.has("w") ? -0.8 : keys.has("ArrowDown") || keys.has("s") ? 0.8 : 0;
      }
      const len = Math.hypot(ax, ay) || 1;
      ax /= len;
      ay /= len;
      for (let i = 0; i < weapon.pellets; i++) {
        const off = weapon.pellets === 1 ? 0 : (i - (weapon.pellets - 1) / 2) * weapon.spread;
        const ca = Math.cos(off);
        const sa = Math.sin(off);
        const dx = ax * ca - ay * sa;
        const dy = ax * sa + ay * ca;
        bolts.push({
          x: cx,
          y: cy,
          vx: dx * weapon.speed,
          vy: dy * weapon.speed,
          dmg: weapon.damage,
          pierce: weapon.pierce,
          homing: weapon.homing,
          splash: weapon.splash,
          life: 1400,
          color: weapon.color,
          hits: new Set<Enemy>(),
        });
      }
      shotCd = weapon.cooldown;
    }

    /* ----------------------------------------------------------------- loop */

    function step(dt: number, now: number) {
      elapsed += dt;
      if (P.invuln > 0) P.invuln -= dt;
      if (P.dashCd > 0) P.dashCd -= dt;
      if (shake > 0) shake -= dt * 0.05;

      const left = keys.has("ArrowLeft") || keys.has("a");
      const right = keys.has("ArrowRight") || keys.has("d");
      const jump = keys.has("ArrowUp") || keys.has("w") || keys.has(" ");

      // dash
      if (canDash && keys.has("Shift") && P.dashCd <= 0 && P.dash <= 0) {
        P.dash = 180;
        P.dashCd = 900;
        P.invuln = Math.max(P.invuln, 200);
        burst(P.x, P.y - PH / 2, "#60a5fa", 12);
      }
      if (P.dash > 0) {
        P.dash -= dt;
        P.vx = P.facing * 0.85;
      } else {
        const dir = (right ? 1 : 0) - (left ? 1 : 0);
        if (dir !== 0) P.facing = dir;
        P.vx += dir * 0.0028 * dt;
        P.vx *= P.onGround ? 0.86 : 0.94;
        P.vx = Math.max(-0.44, Math.min(0.44, P.vx));
      }

      // jump (edge triggered)
      if (jump && !P.jumpHeld) {
        if (P.onGround) {
          P.vy = -0.66;
          P.onGround = false;
          P.jumps = 1;
        } else if (canDouble && P.jumps < 2) {
          P.vy = -0.58;
          P.jumps = 2;
          burst(P.x, P.y, "#a78bfa", 10);
        }
      }
      P.jumpHeld = jump;

      P.vy += GRAV * dt * (canDouble ? 0.9 : 1);
      P.vy = Math.min(1.1, P.vy);

      P.x = Math.max(12, Math.min(level.width - 12, P.x + P.vx * dt));
      const prevY = P.y;
      P.y += P.vy * dt;
      P.onGround = false;

      // platforms (land only from above)
      for (const pl of level.platforms) {
        if (P.x + PW / 2 > pl.x && P.x - PW / 2 < pl.x + pl.w) {
          if (prevY <= pl.y + 2 && P.y >= pl.y && P.vy >= 0) {
            P.y = pl.y;
            P.vy = 0;
            P.onGround = true;
            P.jumps = 0;
          }
        }
      }
      // ground
      if (P.y >= FLOOR_Y && onSolidGround(P.x)) {
        P.y = FLOOR_Y;
        P.vy = 0;
        P.onGround = true;
        P.jumps = 0;
        P.safeX = P.x;
      }
      // pit
      if (P.y > VIEW_H + 60) {
        hurt(1);
        if (!finished) {
          P.x = P.safeX;
          P.y = FLOOR_Y - PH;
          P.vy = 0;
          P.vx = 0;
        }
      }
      // spikes
      for (const sp of level.spikes) {
        if (
          P.x + PW / 2 > sp.x &&
          P.x - PW / 2 < sp.x + sp.w &&
          P.y > sp.y &&
          P.y - PH < sp.y + sp.h
        ) {
          hurt(1);
          P.vy = -0.5;
          P.x -= P.facing * 26;
        }
      }

      // shooting
      if (shotCd > 0) shotCd -= dt;
      if (firing && shotCd <= 0) fire();

      /* enemies */
      const bossAlive = enemies.some((e) => e.kind === "boss" && !e.dead);
      for (const en of enemies) {
        if (en.dead) continue;
        en.t += dt;
        if (en.hitFlash > 0) en.hitFlash -= dt;
        const dxp = P.x - (en.x + en.w / 2);
        const dyp = P.y - PH / 2 - (en.y + en.h / 2);
        const dist = Math.hypot(dxp, dyp);

        if (en.kind === "drone") {
          en.x = en.homeX + Math.sin(en.t / 900) * en.range;
          en.y += Math.sin(en.t / 420) * 0.12;
          if (dist < 430) {
            en.fireAt -= dt;
            if (en.fireAt <= 0) {
              en.fireAt = 1300;
              shootAt(en, dxp, dyp, 0.3);
            }
          }
        } else if (en.kind === "turret") {
          if (dist < 540) {
            en.fireAt -= dt;
            if (en.fireAt <= 0) {
              en.fireAt = 1500;
              for (let k = -1; k <= 1; k++) shootAt(en, dxp, dyp + k * 40, 0.34);
            }
          }
        } else if (en.kind === "walker") {
          const chasing = dist < 300;
          const sp = chasing ? 0.16 : 0.08;
          en.dir = chasing ? Math.sign(dxp) || 1 : en.dir;
          en.x += en.dir * sp * dt;
          if (!chasing && Math.abs(en.x - en.homeX) > en.range) en.dir *= -1;
          if (!onSolidGround(en.x + en.w / 2)) en.dir *= -1;
        } else {
          // boss
          const frac = en.hp / en.maxHp;
          en.phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
          en.y = level.n >= 12 ? FLOOR_Y - 100 + Math.sin(en.t / 700) * 30 : FLOOR_Y - 96 + Math.sin(en.t / 800) * 24;
          en.x += Math.sign(dxp) * (en.phase === 2 ? 0.13 : 0.06) * dt;
          en.x = Math.max(40, Math.min(level.width - 120, en.x));
          en.fireAt -= dt;
          if (en.fireAt <= 0) {
            if (en.phase === 3) {
              en.fireAt = 1500;
              for (let a = 0; a < 12; a++) {
                const ang = (a / 12) * Math.PI * 2;
                ebolts.push({
                  x: en.x + en.w / 2,
                  y: en.y + en.h / 2,
                  vx: Math.cos(ang) * 0.26,
                  vy: Math.sin(ang) * 0.26,
                  life: 3000,
                });
              }
            } else {
              en.fireAt = en.phase === 2 ? 800 : 1100;
              for (let k = -2; k <= 2; k++) shootAt(en, dxp, dyp + k * 46, 0.32);
            }
          }
        }

        // contact damage
        if (
          Math.abs(P.x - (en.x + en.w / 2)) < en.w / 2 + PW / 2 - 4 &&
          P.y > en.y &&
          P.y - PH < en.y + en.h
        ) {
          hurt(1);
        }
      }

      function shootAt(en: Enemy, dx: number, dy: number, speed: number) {
        const l = Math.hypot(dx, dy) || 1;
        ebolts.push({
          x: en.x + en.w / 2,
          y: en.y + en.h / 2,
          vx: (dx / l) * speed,
          vy: (dy / l) * speed,
          life: 3000,
        });
      }

      /* player bolts */
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]!;
        if (b.homing) {
          let best: Enemy | null = null;
          let bd = 320;
          for (const en of enemies) {
            if (en.dead) continue;
            const d = Math.hypot(en.x + en.w / 2 - b.x, en.y + en.h / 2 - b.y);
            if (d < bd) {
              bd = d;
              best = en;
            }
          }
          if (best) {
            const tx = best.x + best.w / 2 - b.x;
            const ty = best.y + best.h / 2 - b.y;
            const l = Math.hypot(tx, ty) || 1;
            b.vx += (tx / l) * 0.0016 * dt;
            b.vy += (ty / l) * 0.0016 * dt;
            const s = Math.hypot(b.vx, b.vy) || 1;
            b.vx = (b.vx / s) * 0.6;
            b.vy = (b.vy / s) * 0.6;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        let gone = b.life <= 0 || b.x < -40 || b.x > level.width + 40 || b.y < -60 || b.y > VIEW_H + 80;

        for (const en of enemies) {
          if (en.dead || b.hits.has(en)) continue;
          if (b.x > en.x && b.x < en.x + en.w && b.y > en.y && b.y < en.y + en.h) {
            damageEnemy(en, b.dmg);
            b.hits.add(en);
            burst(b.x, b.y, b.color, 6);
            if (b.splash > 0) {
              for (const o of enemies) {
                if (o.dead || o === en) continue;
                if (Math.hypot(o.x + o.w / 2 - b.x, o.y + o.h / 2 - b.y) < b.splash)
                  damageEnemy(o, Math.round(b.dmg * 0.6));
              }
              burst(b.x, b.y, "#fb923c", 22);
            }
            if (!b.pierce) gone = true;
            break;
          }
        }
        if (gone) bolts.splice(i, 1);
      }

      /* enemy bolts */
      for (let i = ebolts.length - 1; i >= 0; i--) {
        const b = ebolts[i]!;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (Math.abs(b.x - P.x) < PW / 2 + 4 && b.y > P.y - PH && b.y < P.y) {
          hurt(1);
          ebolts.splice(i, 1);
          continue;
        }
        if (b.life <= 0 || b.y > VIEW_H + 40 || b.x < -60 || b.x > level.width + 60) ebolts.splice(i, 1);
      }

      /* cores */
      for (const co of cores) {
        if (co.taken) continue;
        const d = Math.hypot(co.x - P.x, co.y - (P.y - PH / 2));
        if (magnet && d < 260) {
          co.x += ((P.x - co.x) / d) * 0.3 * dt;
          co.y += ((P.y - PH / 2 - co.y) / d) * 0.3 * dt;
        }
        if (d < 26) {
          co.taken = true;
          collected += 1;
          burst(co.x, co.y, "#fbbf24", 12);
        }
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const pt = parts[i]!;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 0.0004 * dt;
        pt.life -= dt;
        if (pt.life <= 0) parts.splice(i, 1);
      }

      // goal
      if (P.x > level.goalX && (!level.boss || !bossAlive)) end(true);

      camX = Math.max(0, Math.min(level.width - VIEW_W, P.x - VIEW_W * 0.38));
      const bossE = enemies.find((e) => e.kind === "boss");
      setHud({
        hp: Math.max(0, P.hp),
        maxHp,
        kills,
        cores: collected,
        ms: elapsed,
        bossHp: bossE && !bossE.dead ? Math.max(0, bossE.hp) : 0,
        bossMax: bossE?.maxHp ?? 0,
        dashReady: canDash && P.dashCd <= 0,
      });
      void now;
    }

    /* ----------------------------------------------------------------- draw */

    function draw() {
      ctx.save();
      const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

      const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      bg.addColorStop(0, "#080e1c");
      bg.addColorStop(1, "#04070f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // parallax skyline
      ctx.fillStyle = "rgba(45,212,191,0.06)";
      for (let i = 0; i < 26; i++) {
        const bx = ((i * 260 - camX * 0.25) % (VIEW_W + 300)) - 150;
        ctx.fillRect(bx, 150 + ((i * 37) % 90), 90, VIEW_H);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      for (let gx = -((camX * 0.6) % 60); gx < VIEW_W; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, VIEW_H);
        ctx.stroke();
      }

      ctx.translate(-camX + sx, sy);

      // ground
      for (const g of level.ground) {
        const grd = ctx.createLinearGradient(0, FLOOR_Y, 0, VIEW_H);
        grd.addColorStop(0, "rgba(45,212,191,0.35)");
        grd.addColorStop(1, "rgba(8,14,28,0.9)");
        ctx.fillStyle = grd;
        ctx.fillRect(g.x, FLOOR_Y, g.w, VIEW_H - FLOOR_Y);
        ctx.fillStyle = "rgba(94,234,212,0.9)";
        ctx.fillRect(g.x, FLOOR_Y - 2, g.w, 2);
      }
      // platforms
      for (const pl of level.platforms) {
        ctx.fillStyle = "rgba(14,24,44,0.95)";
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.fillStyle = "rgba(94,234,212,0.85)";
        ctx.fillRect(pl.x, pl.y, pl.w, 2);
      }
      // spikes
      for (const sp of level.spikes) {
        ctx.fillStyle = "#f87171";
        const teeth = Math.max(2, Math.round(sp.w / 12));
        for (let i = 0; i < teeth; i++) {
          const tx = sp.x + (i * sp.w) / teeth;
          ctx.beginPath();
          ctx.moveTo(tx, sp.y + sp.h);
          ctx.lineTo(tx + sp.w / teeth / 2, sp.y);
          ctx.lineTo(tx + sp.w / teeth, sp.y + sp.h);
          ctx.closePath();
          ctx.fill();
        }
      }

      // goal gate
      const gateOpen = !level.boss || !enemies.some((e) => e.kind === "boss" && !e.dead);
      ctx.fillStyle = gateOpen ? "rgba(250,204,21,0.85)" : "rgba(248,113,113,0.5)";
      ctx.fillRect(level.goalX, FLOOR_Y - 110, 6, 110);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(level.goalX, FLOOR_Y - 110, 44, 110);
      ctx.globalAlpha = 1;

      // cores
      for (const co of cores) {
        if (co.taken) continue;
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(co.x, co.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // enemies
      for (const en of enemies) {
        if (en.dead) continue;
        const flash = en.hitFlash > 0;
        ctx.save();
        ctx.shadowBlur = 12;
        if (en.kind === "boss") {
          ctx.fillStyle = flash ? "#fff" : "#f472b6";
          ctx.shadowColor = "#f472b6";
          ctx.fillRect(en.x, en.y, en.w, en.h);
          ctx.fillStyle = "#0b1220";
          ctx.fillRect(en.x + 16, en.y + 22, en.w - 32, 14);
        } else if (en.kind === "turret") {
          ctx.fillStyle = flash ? "#fff" : "#fca5a5";
          ctx.shadowColor = "#fca5a5";
          ctx.fillRect(en.x, en.y, en.w, en.h);
          ctx.fillRect(en.x + en.w / 2 - 3, en.y - 8, 6, 10);
        } else if (en.kind === "walker") {
          ctx.fillStyle = flash ? "#fff" : "#fdba74";
          ctx.shadowColor = "#fdba74";
          ctx.fillRect(en.x, en.y, en.w, en.h);
        } else {
          ctx.fillStyle = flash ? "#fff" : "#c4b5fd";
          ctx.shadowColor = "#c4b5fd";
          ctx.beginPath();
          ctx.ellipse(en.x + en.w / 2, en.y + en.h / 2, en.w / 2, en.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        if (en.kind !== "boss") {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(en.x, en.y - 7, en.w, 3);
          ctx.fillStyle = "#5eead4";
          ctx.fillRect(en.x, en.y - 7, (en.w * en.hp) / en.maxHp, 3);
        }
      }

      // bolts
      for (const b of bolts) {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.splash > 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      for (const b of ebolts) {
        ctx.fillStyle = "#f87171";
        ctx.shadowColor = "#f87171";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const pt of parts) {
        ctx.globalAlpha = Math.max(0, pt.life / 380);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // player
      ctx.save();
      if (P.invuln > 0 && Math.floor(P.invuln / 90) % 2 === 0) ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#e8fbf7";
      ctx.shadowColor = P.dash > 0 ? "#60a5fa" : "#2dd4bf";
      ctx.shadowBlur = 18;
      ctx.fillRect(P.x - PW / 2, P.y - PH, PW, PH);
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(P.x - 4 + P.facing * 5, P.y - PH + 8, 7, 5);
      ctx.shadowBlur = 0;
      // muzzle
      let ax = P.facing;
      let ay = 0;
      if (aim) {
        ax = aim.x - P.x;
        ay = aim.y - (P.y - PH / 2);
        const l = Math.hypot(ax, ay) || 1;
        ax /= l;
        ay /= l;
      }
      ctx.strokeStyle = "rgba(94,234,212,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y - PH / 2);
      ctx.lineTo(P.x + ax * 18, P.y - PH / 2 + ay * 18);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    function frame(now: number) {
      const dt = Math.min(32, now - last);
      last = now;
      if (!finished) step(dt, now);
      draw();
      if (!finished) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [level, weapon, gear]);

  const hold = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      keysRef.current.add(key);
    },
    onPointerUp: () => keysRef.current.delete(key),
    onPointerLeave: () => keysRef.current.delete(key),
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full max-w-[760px] items-center justify-between font-mono text-[11px]">
        <span className="flex items-center gap-1">
          {Array.from({ length: hud.maxHp }).map((_, i) => (
            <span
              key={i}
              className={i < hud.hp ? "text-primary" : "text-muted-foreground/30"}
              aria-hidden
            >
              ◆
            </span>
          ))}
        </span>
        <span className="text-muted-foreground flex items-center gap-3">
          <span className="text-gold">✦ {hud.cores}</span>
          <span>{hud.kills} kills</span>
          <span className="numeral">{(hud.ms / 1000).toFixed(1)}s</span>
          {hud.dashReady ? <span className="text-primary">dash ready</span> : null}
        </span>
      </div>

      {hud.bossMax > 0 && hud.bossHp > 0 ? (
        <div className="bg-secondary h-1.5 w-full max-w-[760px] overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-[#f472b6] transition-[width] duration-150"
            style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }}
          />
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="ring-border w-full max-w-[760px] touch-none rounded-xl ring-1"
        style={{ height: "auto" }}
      />

      <div className="text-muted-foreground flex w-full max-w-[760px] items-center justify-between gap-2 lg:hidden">
        <div className="flex gap-2">
          <button className="glass-raised size-12 rounded-xl text-lg" {...hold("a")} aria-label="Left">
            ◀
          </button>
          <button className="glass-raised size-12 rounded-xl text-lg" {...hold("d")} aria-label="Right">
            ▶
          </button>
        </div>
        <div className="flex gap-2">
          <button className="glass-raised size-12 rounded-xl text-xs" {...hold("Shift")} aria-label="Dash">
            DASH
          </button>
          <button className="glass-raised size-12 rounded-xl text-lg" {...hold(" ")} aria-label="Jump">
            ⤒
          </button>
        </div>
      </div>

      <p className="text-muted-foreground text-center font-mono text-[10px]">
        A / D move · W or Space jump · Shift dash · aim with pointer, hold to fire (or J)
      </p>
    </div>
  );
}
