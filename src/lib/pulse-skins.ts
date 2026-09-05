/**
 * PULSE RUSH — cosmetic renderers.
 *
 * Every locker item maps to real canvas art here, so equipping something
 * actually changes what you see in a run (and in the locker previews).
 * Each draw function is given a context already translated/rotated to the
 * player's centre, so it only ever draws around (0, 0).
 */

import type { ColorPair } from "@/lib/pulse";

export type SkinCtx = {
  ctx: CanvasRenderingContext2D;
  /** Half the player size in px. */
  half: number;
  pair: ColorPair;
  /** performance.now()-style clock for animated skins. */
  now: number;
};

/* ---------------------------------------------------------------- utilities */

function ring(ctx: CanvasRenderingContext2D, r: number, color: string, width = 2) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
}

function fillStroke(
  ctx: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  stroke: string | CanvasGradient,
  w = 3,
) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.stroke();
}

function grad(
  ctx: CanvasRenderingContext2D,
  h: number,
  a: string,
  b: string,
  vertical = true,
): CanvasGradient {
  const g = vertical ? ctx.createLinearGradient(0, -h, 0, h) : ctx.createLinearGradient(-h, 0, h, 0);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, s: number, r: number) {
  const h = s / 2;
  ctx.beginPath();
  ctx.moveTo(-h + r, -h);
  ctx.arcTo(h, -h, h, h, r);
  ctx.arcTo(h, h, -h, h, r);
  ctx.arcTo(-h, h, -h, -h, r);
  ctx.arcTo(-h, -h, h, -h, r);
  ctx.closePath();
}

/* -------------------------------------------------------------------- cubes */

export function drawCube(slug: string, s: SkinCtx) {
  const { ctx, half, pair, now } = s;
  const size = half * 2;
  const p = pair.primary;
  const q = pair.secondary;

  switch (slug) {
    case "cube-obsidian": {
      roundRect(ctx, size, 4);
      fillStroke(ctx, grad(ctx, half, "#0b0f19", p), p);
      poly(ctx, [
        [-half, half],
        [half, -half],
        [half, half],
      ]);
      ctx.fillStyle = q + "55";
      ctx.fill();
      break;
    }
    case "cube-chrome": {
      roundRect(ctx, size, 6);
      const g = ctx.createLinearGradient(-half, -half, half, half);
      g.addColorStop(0, "#f8fafc");
      g.addColorStop(0.45, q);
      g.addColorStop(0.5, "#ffffff");
      g.addColorStop(0.55, p);
      g.addColorStop(1, "#94a3b8");
      fillStroke(ctx, g, "#e2e8f0", 2);
      break;
    }
    case "cube-circuit": {
      roundRect(ctx, size, 3);
      fillStroke(ctx, "#0b1220", p);
      ctx.strokeStyle = p;
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-half, i * half * 0.55);
        ctx.lineTo(i * half * 0.3, i * half * 0.55);
        ctx.lineTo(i * half * 0.3, half * (i === 0 ? 0.9 : 0.1));
        ctx.stroke();
      }
      ctx.fillStyle = q;
      ctx.fillRect(-2, -2, 4, 4);
      break;
    }
    case "cube-prism": {
      poly(ctx, [
        [0, -half],
        [half, 0],
        [0, half],
        [-half, 0],
      ]);
      fillStroke(ctx, grad(ctx, half, p, q), "#ffffff", 2);
      roundRect(ctx, size, 4);
      ctx.strokeStyle = p + "66";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "cube-nova": {
      const pulse = 0.5 + 0.5 * Math.sin(now / 220);
      ctx.shadowColor = p;
      ctx.shadowBlur = 16 + pulse * 18;
      roundRect(ctx, size, 5);
      fillStroke(ctx, grad(ctx, half, p, q), "#ffffff", 2);
      ctx.shadowBlur = 0;
      ring(ctx, half * (0.5 + pulse * 0.25), "#ffffff99", 2);
      break;
    }
    case "cube-magma": {
      roundRect(ctx, size, 4);
      fillStroke(ctx, grad(ctx, half, "#7f1d1d", "#f97316"), "#fbbf24", 2);
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-half * 0.8, half * 0.2 + Math.sin(now / 180) * 2);
      ctx.lineTo(-half * 0.1, -half * 0.3);
      ctx.lineTo(half * 0.35, half * 0.35);
      ctx.lineTo(half * 0.85, -half * 0.15);
      ctx.stroke();
      break;
    }
    case "cube-ember": {
      roundRect(ctx, size, 4);
      fillStroke(ctx, grad(ctx, half, "#fb923c", "#7f1d1d"), "#fed7aa", 2);
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(0, -half * 0.15, half * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "cube-aurora": {
      roundRect(ctx, size, 6);
      const g = ctx.createLinearGradient(-half, half, half, -half);
      g.addColorStop(0, "#22d3ee");
      g.addColorStop(0.5, "#5eead4");
      g.addColorStop(1, "#a78bfa");
      fillStroke(ctx, g, "#e0f2fe", 2);
      break;
    }
    case "cube-glitch": {
      roundRect(ctx, size, 2);
      fillStroke(ctx, "#0f172a", p, 2);
      const j = Math.sin(now / 60) * 3;
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(-half + j, -half * 0.55, size, half * 0.28);
      ctx.fillStyle = "#f472b6";
      ctx.fillRect(-half - j, half * 0.2, size, half * 0.24);
      break;
    }
    case "cube-void": {
      roundRect(ctx, size, 8);
      fillStroke(ctx, "#05070d", q, 2);
      const rr = half * (0.55 + 0.1 * Math.sin(now / 300));
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rr);
      g.addColorStop(0, "#000000");
      g.addColorStop(1, p);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    case "cube-halo": {
      roundRect(ctx, size, 5);
      fillStroke(ctx, grad(ctx, half, "#fef9c3", "#fbbf24"), "#fff7ed", 2);
      ctx.save();
      ctx.rotate(-0.3);
      ctx.beginPath();
      ctx.ellipse(0, -half * 1.05, half * 0.9, half * 0.24, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "cube-demon": {
      roundRect(ctx, size, 3);
      fillStroke(ctx, grad(ctx, half, "#450a0a", "#ef4444"), "#fca5a5", 2);
      poly(ctx, [
        [-half * 0.8, -half],
        [-half * 0.45, -half * 1.5],
        [-half * 0.2, -half],
      ]);
      ctx.fillStyle = "#fca5a5";
      ctx.fill();
      poly(ctx, [
        [half * 0.2, -half],
        [half * 0.45, -half * 1.5],
        [half * 0.8, -half],
      ]);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(-half * 0.55, -half * 0.15, half * 0.35, 5);
      ctx.fillRect(half * 0.2, -half * 0.15, half * 0.35, 5);
      break;
    }
    case "cube-relic": {
      roundRect(ctx, size, 4);
      fillStroke(ctx, grad(ctx, half, "#78350f", "#d97706"), "#fcd34d", 3);
      ring(ctx, half * 0.55, "#fef3c7", 2);
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(-1.5, -half * 0.55, 3, half * 1.1);
      break;
    }
    case "cube-hunter": {
      roundRect(ctx, size, 4);
      fillStroke(ctx, grad(ctx, half, "#0f172a", "#334155"), "#fbbf24", 3);
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "cube-flawless": {
      roundRect(ctx, size, 5);
      fillStroke(ctx, "#f8fafc", p, 3);
      poly(ctx, [
        [0, -half * 0.6],
        [half * 0.6, 0],
        [0, half * 0.6],
        [-half * 0.6, 0],
      ]);
      fillStroke(ctx, grad(ctx, half, p, q), "#ffffff", 1.5);
      break;
    }
    case "cube-ascend": {
      roundRect(ctx, size, 5);
      fillStroke(ctx, grad(ctx, half, q, p), "#ffffff", 2);
      for (let i = 0; i < 3; i++) {
        const o = -half * 0.6 + i * half * 0.55;
        ctx.beginPath();
        ctx.moveTo(-half * 0.55, o + half * 0.3);
        ctx.lineTo(0, o - half * 0.15);
        ctx.lineTo(half * 0.55, o + half * 0.3);
        ctx.strokeStyle = "#ffffffcc";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case "cube-prime": {
      const spin = (now / 900) % (Math.PI * 2);
      ctx.shadowColor = q;
      ctx.shadowBlur = 22;
      roundRect(ctx, size, 6);
      const g = ctx.createLinearGradient(-half, -half, half, half);
      g.addColorStop(0, "#e879f9");
      g.addColorStop(0.5, "#22d3ee");
      g.addColorStop(1, "#fbbf24");
      fillStroke(ctx, g, "#ffffff", 2);
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.rotate(spin);
      ring(ctx, half * 1.15, "#ffffff66", 2);
      ctx.restore();
      break;
    }
    case "cube-tide": {
      roundRect(ctx, size, 6);
      fillStroke(ctx, grad(ctx, half, "#164e63", p), "#a5f3fc", 2);
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const wob = Math.sin(now / 260) * 2;
      ctx.moveTo(-half * 0.75, wob);
      ctx.quadraticCurveTo(-half * 0.25, -half * 0.3 + wob, half * 0.25, wob);
      ctx.quadraticCurveTo(half * 0.6, half * 0.25 + wob, half * 0.8, wob);
      ctx.stroke();
      break;
    }
    case "cube-rose": {
      roundRect(ctx, size, 5);
      fillStroke(ctx, grad(ctx, half, "#881337", "#fb7185"), "#fecdd3", 2);
      ctx.fillStyle = "#fff1f2";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + now / 2400;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * half * 0.32, Math.sin(a) * half * 0.32, half * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = "#fda4af";
      ctx.fill();
      break;
    }
    case "cube-storm": {
      roundRect(ctx, size, 3);
      fillStroke(ctx, grad(ctx, half, "#1e293b", "#475569"), p, 3);
      poly(ctx, [
        [half * 0.15, -half * 0.75],
        [-half * 0.35, half * 0.1],
        [0, half * 0.1],
        [-half * 0.15, half * 0.75],
        [half * 0.35, -half * 0.1],
        [0, -half * 0.1],
      ]);
      ctx.fillStyle = Math.sin(now / 120) > 0 ? "#fde68a" : "#fbbf24";
      ctx.fill();
      break;
    }
    default: {
      // cube-origin and any future default
      roundRect(ctx, size, 4);
      fillStroke(ctx, p, q, 3);
      ctx.fillStyle = q;
      ctx.fillRect(-half * 0.4, -half * 0.4, size * 0.4, size * 0.4);
    }
  }
}

/* -------------------------------------------------------------------- ships */

export function drawShip(slug: string, s: SkinCtx) {
  const { ctx, half, pair, now } = s;
  const p = pair.primary;
  const q = pair.secondary;

  switch (slug) {
    case "ship-dart":
      poly(ctx, [
        [-half * 1.1, -half * 0.45],
        [half * 1.45, 0],
        [-half * 1.1, half * 0.45],
        [-half * 0.6, 0],
      ]);
      fillStroke(ctx, grad(ctx, half, p, q), "#ffffff", 2);
      break;
    case "ship-kite":
      poly(ctx, [
        [-half * 0.2, -half],
        [half * 1.2, 0],
        [-half * 0.2, half],
        [-half * 1.1, 0],
      ]);
      fillStroke(ctx, grad(ctx, half, q, p), p, 2);
      break;
    case "ship-raptor":
      poly(ctx, [
        [-half, -half * 0.9],
        [half * 0.2, -half * 0.35],
        [half * 1.3, 0],
        [half * 0.2, half * 0.35],
        [-half, half * 0.9],
        [-half * 0.35, 0],
      ]);
      fillStroke(ctx, grad(ctx, half, "#0f172a", p), q, 2);
      break;
    case "ship-seraph":
      poly(ctx, [
        [-half * 0.9, -half * 1.1],
        [half * 1.25, 0],
        [-half * 0.9, half * 1.1],
        [-half * 0.2, 0],
      ]);
      ctx.shadowColor = p;
      ctx.shadowBlur = 16 + 8 * Math.sin(now / 260);
      fillStroke(ctx, grad(ctx, half, "#fef9c3", p), "#ffffff", 2);
      ctx.shadowBlur = 0;
      break;
    case "ship-eclipse":
      poly(ctx, [
        [-half, -half * 0.7],
        [half * 1.35, 0],
        [-half, half * 0.7],
      ]);
      fillStroke(ctx, "#05070d", p, 3);
      ctx.beginPath();
      ctx.arc(half * 0.1, 0, half * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = q;
      ctx.fill();
      break;
    case "ship-comet":
      poly(ctx, [
        [-half * 0.9, -half * 0.7],
        [half * 1.3, 0],
        [-half * 0.9, half * 0.7],
      ]);
      fillStroke(ctx, grad(ctx, half, "#e0f2fe", p), "#ffffff", 2);
      ctx.beginPath();
      ctx.arc(half * 0.25, 0, half * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      break;
    case "ship-aurora": {
      poly(ctx, [
        [-half, -half * 1.05],
        [half * 1.35, 0],
        [-half, half * 1.05],
        [-half * 0.3, 0],
      ]);
      const g = ctx.createLinearGradient(0, -half, 0, half);
      g.addColorStop(0, "#22d3ee");
      g.addColorStop(0.5, p);
      g.addColorStop(1, "#a78bfa");
      ctx.shadowColor = p;
      ctx.shadowBlur = 12 + 6 * Math.sin(now / 300);
      fillStroke(ctx, g, "#e0f2fe", 2);
      ctx.shadowBlur = 0;
      break;
    }
    default:
      poly(ctx, [
        [-half, -half * 0.7],
        [half * 1.2, 0],
        [-half, half * 0.7],
      ]);
      fillStroke(ctx, p, q, 3);
  }
  // engine glow, common to every wing
  ctx.beginPath();
  ctx.moveTo(-half * 1.05, -half * 0.28);
  ctx.lineTo(-half * 1.75 - Math.random() * 5, 0);
  ctx.lineTo(-half * 1.05, half * 0.28);
  ctx.closePath();
  ctx.fillStyle = q + "aa";
  ctx.fill();
}

/* -------------------------------------------------------------------- balls */

export function drawBall(slug: string, s: SkinCtx) {
  const { ctx, half, pair, now } = s;
  const p = pair.primary;
  const q = pair.secondary;
  const spin = (now / 260) % (Math.PI * 2);

  ctx.beginPath();
  ctx.arc(0, 0, half, 0, Math.PI * 2);

  switch (slug) {
    case "ball-gyro": {
      fillStroke(ctx, "#0f172a", p, 3);
      ctx.save();
      ctx.rotate(spin);
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 0.85, half * 0.3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = q;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 0.3, half * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = p;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "ball-quasar": {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, half);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.6, p);
      g.addColorStop(1, q);
      fillStroke(ctx, g, "#ffffff", 2);
      ctx.save();
      ctx.rotate(spin * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 1.5, half * 0.22, 0, 0, Math.PI * 2);
      ctx.strokeStyle = q + "cc";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "ball-singularity": {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, half);
      g.addColorStop(0, "#000000");
      g.addColorStop(0.7, "#0b1020");
      g.addColorStop(1, p);
      fillStroke(ctx, g, q, 2);
      ctx.save();
      ctx.rotate(-spin);
      ring(ctx, half * 0.62, "#ffffff88", 2);
      ctx.restore();
      break;
    }
    default: {
      fillStroke(ctx, p, q, 3);
      ctx.save();
      ctx.rotate(spin);
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = q;
      ctx.fill();
      ctx.restore();
    }
  }
}

/* -------------------------------------------------------------------- waves */

export function drawWave(slug: string, s: SkinCtx) {
  const { ctx, half, pair } = s;
  const p = pair.primary;
  const q = pair.secondary;

  switch (slug) {
    case "wave-needle":
      poly(ctx, [
        [-half * 1.3, 0],
        [0, -half * 0.45],
        [half * 1.3, 0],
        [0, half * 0.45],
      ]);
      fillStroke(ctx, grad(ctx, half, p, q), "#ffffff", 2);
      break;
    case "wave-serpent":
      poly(ctx, [
        [-half, half * 0.5],
        [-half * 0.2, -half * 0.8],
        [half, -half * 0.5],
        [half * 0.2, half * 0.8],
      ]);
      fillStroke(ctx, grad(ctx, half, q, p), p, 2);
      break;
    case "wave-phantom":
      poly(ctx, [
        [-half, 0],
        [0, -half * 0.8],
        [half, 0],
        [0, half * 0.8],
      ]);
      ctx.globalAlpha = 0.55;
      fillStroke(ctx, p, "#ffffff", 2);
      ctx.globalAlpha = 1;
      break;
    default:
      poly(ctx, [
        [-half, 0],
        [0, -half * 0.75],
        [half, 0],
        [0, half * 0.75],
      ]);
      fillStroke(ctx, p, q, 3);
  }
}

/* -------------------------------------------------------------------- trail */

export type TrailStyle = {
  /** particles spawned per physics tick */
  density: number;
  life: number;
  size: number;
  /** draw shape */
  shape: "square" | "dot" | "spark" | "ring";
  /** blends between primary and secondary over the particle's life */
  dual: boolean;
  glow: number;
};

export function trailStyle(slug: string): TrailStyle {
  switch (slug) {
    case "trail-ember":
      return { density: 2, life: 520, size: 5, shape: "dot", dual: true, glow: 10 };
    case "trail-stardust":
      return { density: 3, life: 700, size: 3, shape: "spark", dual: true, glow: 8 };
    case "trail-ribbon":
      return { density: 1, life: 900, size: 9, shape: "square", dual: false, glow: 0 };
    case "trail-aurora":
      return { density: 2, life: 800, size: 7, shape: "dot", dual: true, glow: 14 };
    case "trail-eternal":
      return { density: 1, life: 1600, size: 5, shape: "dot", dual: false, glow: 6 };
    case "trail-fracture":
      return { density: 1, life: 380, size: 5, shape: "spark", dual: true, glow: 0 };
    case "trail-pulse":
      return { density: 1, life: 620, size: 10, shape: "ring", dual: false, glow: 12 };
    default: // trail-plasma
      return { density: 1, life: 460, size: 5, shape: "dot", dual: false, glow: 12 };
  }
}

export function drawTrailParticle(
  ctx: CanvasRenderingContext2D,
  style: TrailStyle,
  px: number,
  py: number,
  size: number,
  alpha: number,
) {
  ctx.globalAlpha = alpha;
  switch (style.shape) {
    case "dot":
      ctx.beginPath();
      ctx.arc(px, py, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "ring":
      ctx.beginPath();
      ctx.arc(px, py, (size / 2) * (1.4 - alpha), 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.stroke();
      break;
    case "spark":
      ctx.beginPath();
      ctx.moveTo(px - size, py);
      ctx.lineTo(px, py - size * 0.6);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px, py + size * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------------- death */

export type DeathStyle = {
  count: number;
  speed: number;
  /** negative speed implodes */
  inward: boolean;
  size: number;
  life: number;
  shape: "square" | "dot" | "shard" | "ring";
  shockwave: boolean;
  flash: number;
  shake: number;
};

export function deathStyle(slug: string): DeathStyle {
  switch (slug) {
    case "death-silence":
      return { count: 6, speed: 0.06, inward: false, size: 3, life: 400, shape: "dot", shockwave: false, flash: 0.05, shake: 3 };
    case "death-pixel":
      return { count: 40, speed: 0.24, inward: false, size: 4, life: 520, shape: "square", shockwave: false, flash: 0.25, shake: 10 };
    case "death-implode":
      return { count: 26, speed: 0.26, inward: true, size: 5, life: 460, shape: "dot", shockwave: false, flash: 0.2, shake: 8 };
    case "death-nova":
      return { count: 46, speed: 0.34, inward: false, size: 6, life: 700, shape: "dot", shockwave: true, flash: 0.5, shake: 18 };
    case "death-collapse":
      return { count: 30, speed: 0.18, inward: true, size: 7, life: 620, shape: "shard", shockwave: true, flash: 0.3, shake: 14 };
    case "death-static":
      return { count: 60, speed: 0.3, inward: false, size: 3, life: 340, shape: "square", shockwave: false, flash: 0.4, shake: 16 };
    default: // death-shatter
      return { count: 24, speed: 0.28, inward: false, size: 7, life: 560, shape: "shard", shockwave: false, flash: 0.3, shake: 14 };
  }
}

export function drawDeathParticle(
  ctx: CanvasRenderingContext2D,
  style: DeathStyle,
  px: number,
  py: number,
  size: number,
  alpha: number,
  rot: number,
) {
  ctx.globalAlpha = alpha;
  if (style.shape === "shard") {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.4);
    ctx.lineTo(0, -size);
    ctx.lineTo(size, size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (style.shape === "dot") {
    ctx.beginPath();
    ctx.arc(px, py, size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ preview */

/** Draws a locker preview for any item kind onto a small square canvas. */
export function drawPreview(
  ctx: CanvasRenderingContext2D,
  kind: string,
  slug: string,
  pair: ColorPair,
  size: number,
  now: number,
) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  const half = size * 0.26;
  const s: SkinCtx = { ctx, half, pair, now };

  if (kind === "icon") drawCube(slug, s);
  else if (kind === "ship") drawShip(slug, s);
  else if (kind === "ball") drawBall(slug, s);
  else if (kind === "wave") drawWave(slug, s);
  else if (kind === "colors") {
    ctx.beginPath();
    ctx.arc(0, 0, half * 1.2, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(-half, -half, half, half);
    g.addColorStop(0, pair.primary);
    g.addColorStop(1, pair.secondary);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#ffffff55";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (kind === "trail") {
    const st = trailStyle(slug);
    ctx.fillStyle = pair.primary;
    for (let i = 0; i < 7; i++) {
      const a = 1 - i / 7;
      ctx.fillStyle = st.dual && i % 2 ? pair.secondary : pair.primary;
      drawTrailParticle(ctx, st, half * 1.2 - i * (size * 0.11), Math.sin(i + now / 300) * 3, st.size, a);
    }
    drawCube("cube-origin", { ctx, half: half * 0.7, pair, now });
  } else if (kind === "death") {
    const st = deathStyle(slug);
    const t = (now / 900) % 1;
    const n = Math.min(14, st.count);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n;
      const d = st.inward ? (1 - t) * half * 1.7 : t * half * 1.9;
      ctx.fillStyle = t < 0.5 ? pair.primary : pair.secondary;
      drawDeathParticle(ctx, st, Math.cos(ang) * d, Math.sin(ang) * d, st.size, 1 - t, ang);
    }
    if (st.shockwave) {
      ctx.strokeStyle = pair.primary + "88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, t * half * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
