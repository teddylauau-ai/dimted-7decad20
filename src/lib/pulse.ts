/**
 * PULSE RUSH — Dimted's flagship rhythm runner.
 *
 * One button. You auto-run forward, tap to jump, and the level is a fixed,
 * memorisable sequence of hazards placed on a musical grid. Levels are authored
 * as a sequence of named patterns so the rhythm stays readable, and the builder
 * turns that sequence into concrete world objects the engine can simulate.
 *
 * Everything here is pure data + maths. No React, no canvas.
 */

/** One grid unit in pixels. The cube is just under one unit tall. */
export const U = 32;
export const CUBE = U * 0.9;
/** Floor line, measured in pixels from the top of the view. */
export const VIEW_H = 420;
export const VIEW_W = 880;
export const FLOOR = 330;
/** Ceiling for flight sections. */
export const ROOF = 40;

export const BASE_SPEED = 0.3; // px per ms at 1x
export const SPEED_STEPS = [0.72, 1, 1.25, 1.5, 1.85] as const;

export const GRAVITY = 0.0032;
/**
 * Tuned so a jump peaks a shade over 2.5 units and covers ~4.3 units of ground
 * at 1x — the same "two blocks up, four blocks across" arc Geometry Dash uses,
 * which is what makes single-block hops forgiving instead of frame-perfect.
 */
export const JUMP_V = 0.73;

export type Mode = "cube" | "ship" | "ball" | "wave";

export type Obj =
  /** Triangle hazard sitting on a surface. `up` false means it hangs from the ceiling. */
  | { t: "spike"; x: number; y: number; up: boolean }
  /** Solid block. Land on the top, die on the sides. */
  | { t: "block"; x: number; y: number; w: number; h: number }
  /** Spinning blade. Lethal circle. */
  | { t: "saw"; x: number; y: number; r: number }
  /** Yellow pad: launches you on contact. */
  | { t: "pad"; x: number; y: number }
  /** Orb: tap while touching it for a free jump. */
  | { t: "orb"; x: number; y: number }
  | { t: "portal"; x: number; mode: Mode }
  | { t: "gravity"; x: number; dir: 1 | -1 }
  | { t: "speed"; x: number; step: number }
  | { t: "coin"; x: number; y: number; i: 0 | 1 | 2 };

export type Difficulty = "easy" | "normal" | "hard" | "harder" | "insane" | "demon";

export type Palette = {
  /** Background gradient stops. */
  bgA: string;
  bgB: string;
  /** Ground fill + edge. */
  ground: string;
  edge: string;
  /** Obstacle fill. */
  solid: string;
  glow: string;
};

export type LevelDef = {
  n: number;
  name: string;
  brief: string;
  difficulty: Difficulty;
  bpm: number;
  palette: Palette;
  seq: Step[];
  /**
   * Forgiveness dial for the early campaign. Extra units of breathing room added
   * to every hazard gap, and (at >= 1.5) low ceilings are dropped entirely so a
   * new player only ever has to solve one obstacle at a time.
   */
  ease?: number;
};

/* ------------------------------------------------------------------ patterns */

type Step =
  | ["flat", number]
  | ["spike", number]
  | ["spikes", number, number]
  | ["stair", number]
  | ["pillars", number, number]
  | ["gap", number, number]
  | ["saws", number]
  | ["pad"]
  | ["orbs", number]
  | ["tight", number]
  | ["ship", number, number]
  | ["wave", number, number]
  | ["ball", number]
  | ["speed", number]
  | ["coin", number]
  | ["mode", Mode];

type Built = { objects: Obj[]; length: number; coinCount: number };

/**
 * Convert an authored sequence into world objects. `x` walks forward in grid
 * units; each pattern decides how much room it needs so spacing stays musical.
 */
export function buildLevel(def: LevelDef): Built {
  const out: Obj[] = [];
  let x = 6;
  let coin = 0;
  let mode: Mode = "cube";
  /**
   * Current speed multiplier. Every hazard gap is measured in "jumps", not raw
   * units, so a pattern that reads at 1x still reads at 1.85x — exactly how
   * Geometry Dash keeps its spacing musical when a speed portal hits.
   */
  let spd = 1;
  /** Extra breathing room in units (see LevelDef.ease). */
  const ease = def.ease ?? 0;
  /** Ceilings are dropped on the most forgiving levels. */
  const noCeiling = ease >= 1.5;
  const pad = () => ease * spd;
  /** One jump covers ~4.3 units of ground at 1x. Peak height is ~2.6 units. */
  const JUMP_RUN = 4.3;
  const reach = () => JUMP_RUN * spd;
  const push = (o: Obj) => out.push(o);

  for (const step of def.seq) {
    switch (step[0]) {
      case "flat":
        x += step[1] * spd;
        break;

      case "spike":
        push({ t: "spike", x, y: 0, up: true });
        x += reach() + 1;
        break;

      case "spikes": {
        const n = step[1];
        // Each spike is its own tap: never closer than a full jump run.
        const gap = Math.max(step[2], JUMP_RUN + 1.2) * spd + pad();
        for (let i = 0; i < n; i++) push({ t: "spike", x: x + i * gap, y: 0, up: true });
        x += n * gap + 2 * spd;
        break;
      }

      case "stair": {
        // Solid steps rising from the ground, one unit at a time, then back down.
        const n = Math.min(3, step[1]);
        const w = 2.8 * spd;
        // Rises of one unit only, and never higher than two: each hop has a wide
        // landing window instead of a single perfect frame.
        const hAt = (i: number) => Math.min(2, i + 1);
        for (let i = 0; i < n; i++) push({ t: "block", x: x + i * w, y: 0, w, h: hAt(i) });
        for (let i = 0; i < n - 1; i++)
          push({ t: "block", x: x + n * w + i * w, y: 0, w, h: hAt(n - 2 - i) });
        x += (2 * n - 1) * w + reach();
        break;
      }

      case "pillars": {
        const n = step[1];
        const h = Math.min(2, step[2]);
        const gap = reach() + 2.6 * spd + pad();
        for (let i = 0; i < n; i++) {
          // Solid pillar from the ground, then a spike a clean jump later.
          push({ t: "block", x: x + i * gap, y: 0, w: 1.4 * spd, h });
          push({ t: "spike", x: x + i * gap + reach() * 0.75 + 1.4, y: 0, up: true });
        }
        x += n * gap + reach();
        break;
      }

      case "gap": {
        // Two solid platforms with a spiked trench between them.
        const w = Math.max(2.5, Math.min(step[1], JUMP_RUN - 0.8)) * spd;
        const h = Math.min(2, step[2]);
        const pw = 2.4 * spd;
        push({ t: "block", x, y: 0, w: pw, h });
        push({ t: "spike", x: x + pw + w / 2 - 0.5, y: 0, up: true });
        push({ t: "block", x: x + pw + w, y: 0, w: pw, h });
        x += pw * 2 + w + reach();
        break;
      }

      case "saws": {
        const n = step[1];
        const gap = reach() + 2.4 * spd + pad();
        for (let i = 0; i < n; i++) push({ t: "saw", x: x + i * gap, y: 0.5, r: 0.65 });
        x += n * gap + reach();
        break;
      }

      case "pad":
        push({ t: "pad", x, y: 0 });
        push({ t: "saw", x: x + reach() * 0.9, y: 0.5, r: 0.65 });
        x += reach() * 2 + 2;
        break;

      case "orbs": {
        const n = step[1];
        const gap = reach() + 3 * spd + pad();
        for (let i = 0; i < n; i++) {
          push({ t: "orb", x: x + i * gap, y: 2.2 });
          push({ t: "spike", x: x + i * gap + 2.2 * spd, y: 0, up: true });
        }
        x += n * gap + reach();
        break;
      }

      case "tight": {
        // Straight-fly style corridor: ground spikes on the beat with a low
        // ceiling overhead, so you tap rather than hold.
        const n = step[1];
        const gap = reach() + 1.4 * spd + pad();
        for (let i = 0; i < n; i++) {
          push({ t: "spike", x: x + i * gap, y: 0, up: true });
          if (i % 2 === 1 && !noCeiling)
            push({ t: "block", x: x + i * gap + 1.6, y: 4.4, w: 2 * spd, h: 1 });
        }
        x += n * gap + reach();
        break;
      }

      case "ship": {
        const len = step[1] * spd;
        const tight = step[2];
        push({ t: "portal", x, mode: "ship" });
        mode = "ship";
        const gap = 7 * spd + pad();
        for (let i = gap; i < len - gap; i += gap) {
          const high = Math.round(i / gap) % 2 === 0;
          const h = (tight ? 3 : 2.4) - Math.min(0.8, ease * 0.4);
          push({ t: "block", x: x + i, y: high ? 8.5 - h : 0, w: 1.4 * spd, h });
        }
        x += len;
        push({ t: "portal", x, mode: "cube" });
        mode = "cube";
        x += reach() + 2;
        break;
      }

      case "wave": {
        const len = step[1] * spd;
        const tight = step[2];
        push({ t: "portal", x, mode: "wave" });
        mode = "wave";
        const gap = 6.5 * spd + pad();
        for (let i = gap; i < len - gap; i += gap) {
          const high = Math.round(i / gap) % 2 === 0;
          const h = (tight ? 3.2 : 2.6) - Math.min(0.8, ease * 0.4);
          push({ t: "block", x: x + i, y: high ? 8.5 - h : 0, w: 1.1 * spd, h });
        }
        x += len;
        push({ t: "portal", x, mode: "cube" });
        mode = "cube";
        x += reach() + 2;
        break;
      }

      case "ball": {
        const len = step[1] * spd;
        push({ t: "portal", x, mode: "ball" });
        mode = "ball";
        const gap = 8 * spd + pad();
        for (let i = gap; i < len - gap; i += gap) {
          const top = Math.round(i / gap) % 2 === 0;
          push({ t: "spike", x: x + i, y: 0, up: !top });
          push({ t: "block", x: x + i + gap * 0.45, y: top ? 6.4 : 0, w: 2 * spd, h: 1 });
        }
        x += len;
        push({ t: "portal", x, mode: "cube" });
        mode = "cube";
        x += reach() + 2;
        break;
      }

      case "speed": {
        const next = SPEED_STEPS[Math.max(0, Math.min(4, step[1]))]!;
        push({ t: "speed", x, step: step[1] });
        // Breathing room so the new spacing registers before the next hazard.
        x += 3 * Math.max(spd, next);
        spd = next;
        break;
      }

      case "coin": {
        const height = step[1];
        if (coin < 3) {
          push({ t: "coin", x, y: height, i: coin as 0 | 1 | 2 });
          coin += 1;
        }
        x += reach();
        break;
      }

      case "mode":
        push({ t: "portal", x, mode: step[1] });
        mode = step[1];
        x += reach();
        break;
    }
  }

  // Always end on solid ground with a little runway.
  const length = x + 8 * spd;
  if (mode !== "cube") out.push({ t: "portal", x: length - 6 * spd, mode: "cube" });
  return { objects: out, length, coinCount: coin };
}


/* -------------------------------------------------------------------- levels */

const PAL = {
  dawn: { bgA: "#0b1220", bgB: "#123047", ground: "#0e2233", edge: "#5eead4", solid: "#123b4d", glow: "#5eead4" },
  ember: { bgA: "#140b12", bgB: "#3a1620", ground: "#2a1018", edge: "#fb923c", solid: "#3d1a1f", glow: "#fb923c" },
  void: { bgA: "#07070d", bgB: "#171130", ground: "#100d22", edge: "#a78bfa", solid: "#1d1738", glow: "#a78bfa" },
  toxic: { bgA: "#08120c", bgB: "#12301c", ground: "#0d2415", edge: "#a3e635", solid: "#143a20", glow: "#a3e635" },
  royal: { bgA: "#0a0d1c", bgB: "#1b1f4a", ground: "#121636", edge: "#818cf8", solid: "#1b2150", glow: "#c7d2fe" },
  blood: { bgA: "#100708", bgB: "#3b1013", ground: "#2a0c0f", edge: "#f87171", solid: "#3a1418", glow: "#fca5a5" },
  gold: { bgA: "#120e05", bgB: "#3a2b0c", ground: "#291f08", edge: "#fbbf24", solid: "#3b2c0d", glow: "#fde68a" },
} satisfies Record<string, Palette>;

export const LEVELS: LevelDef[] = [
  {
    n: 1,
    name: "Ignition",
    brief: "One tap, one jump. Learn the arc.",
    difficulty: "easy",
    bpm: 128,
    palette: PAL.dawn,
    seq: [
      ["flat", 8], ["spike", 0], ["flat", 4], ["spike", 0], ["flat", 3],
      ["coin", 3], ["flat", 4], ["stair", 3], ["flat", 4],
      ["spikes", 2, 4], ["flat", 6], ["coin", 4], ["flat", 4],
      ["gap", 3, 1], ["flat", 5], ["spike", 0], ["flat", 6], ["coin", 3], ["flat", 10],
    ],
  },
  {
    n: 2,
    name: "Metronome",
    brief: "Even spacing. Find the beat and hold it.",
    difficulty: "easy",
    bpm: 130,
    palette: PAL.dawn,
    seq: [
      ["flat", 6], ["spikes", 3, 4], ["flat", 4], ["coin", 3], ["stair", 4],
      ["flat", 3], ["spikes", 4, 4], ["flat", 4], ["pillars", 2, 2],
      ["coin", 5], ["flat", 4], ["gap", 4, 2], ["flat", 4], ["spikes", 3, 4],
      ["flat", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 3,
    name: "First Flight",
    brief: "Ship portal. Hold to rise, release to fall.",
    difficulty: "easy",
    bpm: 132,
    palette: PAL.dawn,
    seq: [
      ["flat", 6], ["spike", 0], ["flat", 4], ["ship", 34, 0],
      ["coin", 4], ["flat", 4], ["spikes", 3, 4], ["flat", 4],
      ["ship", 30, 0], ["coin", 5], ["flat", 4], ["stair", 3],
      ["flat", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 4,
    name: "Pressure Drop",
    brief: "Speed portals. Same shapes, less time.",
    difficulty: "normal",
    bpm: 140,
    palette: PAL.ember,
    seq: [
      ["flat", 6], ["spikes", 3, 4], ["speed", 2], ["flat", 4],
      ["spikes", 4, 4], ["flat", 3], ["coin", 3], ["pillars", 3, 2],
      ["speed", 1], ["flat", 4], ["tight", 4], ["coin", 5], ["flat", 4],
      ["gap", 5, 2], ["speed", 2], ["flat", 5], ["spikes", 4, 4],
      ["flat", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 5,
    name: "Neon Drift",
    brief: "Orbs and pads. Chain the bounce.",
    difficulty: "normal",
    bpm: 142,
    palette: PAL.ember,
    seq: [
      ["flat", 6], ["orbs", 2], ["flat", 4], ["pad"], ["coin", 6],
      ["flat", 4], ["orbs", 3], ["flat", 4], ["saws", 2],
      ["coin", 4], ["flat", 4], ["pad"], ["flat", 4], ["orbs", 2],
      ["flat", 4], ["tight", 5], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 6,
    name: "Undertow",
    brief: "Ball mode. Tap flips gravity.",
    difficulty: "normal",
    bpm: 144,
    palette: PAL.toxic,
    seq: [
      ["flat", 6], ["spikes", 2, 4], ["ball", 34], ["coin", 4],
      ["flat", 4], ["spikes", 3, 4], ["ball", 30], ["flat", 4],
      ["coin", 5], ["stair", 3], ["flat", 4], ["saws", 2],
      ["flat", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 7,
    name: "Sawmill",
    brief: "Blades everywhere. Jump early, not fast.",
    difficulty: "hard",
    bpm: 148,
    palette: PAL.toxic,
    seq: [
      ["flat", 6], ["saws", 3], ["coin", 4], ["flat", 4], ["saws", 2],
      ["speed", 2], ["flat", 4], ["tight", 5], ["coin", 5],
      ["flat", 4], ["saws", 3], ["flat", 4], ["pillars", 3, 3],
      ["speed", 1], ["flat", 4], ["saws", 2], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 8,
    name: "Wavelength",
    brief: "Wave mode. Forty-five degrees, no mercy.",
    difficulty: "hard",
    bpm: 150,
    palette: PAL.void,
    seq: [
      ["flat", 6], ["spikes", 2, 4], ["wave", 32, 0], ["coin", 4],
      ["flat", 4], ["tight", 4], ["wave", 30, 0], ["flat", 4],
      ["coin", 5], ["saws", 2], ["flat", 4], ["wave", 26, 1],
      ["flat", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 9,
    name: "Static Bloom",
    brief: "Mode swaps mid-phrase. Read ahead.",
    difficulty: "hard",
    bpm: 152,
    palette: PAL.void,
    seq: [
      ["flat", 6], ["tight", 4], ["ship", 26, 1], ["coin", 5],
      ["ball", 24], ["flat", 4], ["spikes", 4, 4], ["wave", 24, 0],
      ["coin", 4], ["flat", 4], ["saws", 3], ["speed", 2],
      ["tight", 5], ["flat", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 10,
    name: "Iron Cadence",
    brief: "Long, dense, unforgiving spacing.",
    difficulty: "harder",
    bpm: 156,
    palette: PAL.royal,
    seq: [
      ["flat", 6], ["spikes", 4, 4], ["pillars", 3, 3], ["coin", 5],
      ["speed", 2], ["tight", 6], ["flat", 4], ["saws", 3],
      ["orbs", 3], ["coin", 6], ["flat", 4], ["ship", 28, 1],
      ["spikes", 4, 4], ["flat", 4], ["gap", 5, 3], ["speed", 3],
      ["tight", 5], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 11,
    name: "Overdrive",
    brief: "Top speed most of the way. Memorise it.",
    difficulty: "harder",
    bpm: 160,
    palette: PAL.royal,
    seq: [
      ["flat", 6], ["speed", 3], ["spikes", 4, 4], ["tight", 5],
      ["coin", 5], ["saws", 3], ["ship", 30, 1], ["flat", 4],
      ["orbs", 3], ["coin", 6], ["ball", 26], ["speed", 4],
      ["tight", 6], ["flat", 4], ["spikes", 5, 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 12,
    name: "Blood Circuit",
    brief: "Insane. Every mode, every hazard, full tilt.",
    difficulty: "insane",
    bpm: 164,
    palette: PAL.blood,
    seq: [
      ["flat", 6], ["speed", 3], ["tight", 6], ["saws", 3],
      ["coin", 6], ["wave", 26, 1], ["spikes", 5, 4], ["ship", 28, 1],
      ["orbs", 4], ["coin", 5], ["ball", 26], ["speed", 4],
      ["pillars", 4, 3], ["tight", 6], ["saws", 3], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 13,
    name: "Nightfall",
    brief: "Insane. Low light, tight windows, no rest.",
    difficulty: "insane",
    bpm: 168,
    palette: PAL.blood,
    seq: [
      ["flat", 6], ["speed", 3], ["spikes", 5, 4], ["ship", 30, 1],
      ["coin", 6], ["tight", 7], ["saws", 4], ["wave", 28, 1],
      ["orbs", 4], ["coin", 5], ["speed", 4], ["ball", 28],
      ["pillars", 4, 3], ["tight", 6], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 14,
    name: "Event Horizon",
    brief: "Demon. If you clear this, you earned it.",
    difficulty: "demon",
    bpm: 172,
    palette: PAL.gold,
    seq: [
      ["flat", 6], ["speed", 4], ["tight", 7], ["saws", 4],
      ["coin", 6], ["wave", 30, 1], ["ship", 30, 1], ["spikes", 6, 4],
      ["orbs", 4], ["coin", 5], ["ball", 30], ["pillars", 5, 3],
      ["tight", 8], ["saws", 4], ["coin", 3], ["flat", 8],
    ],
  },
  {
    n: 15,
    name: "Dimted Prime",
    brief: "Demon finale. The whole game in one run.",
    difficulty: "demon",
    bpm: 178,
    palette: PAL.gold,
    seq: [
      ["flat", 6], ["speed", 4], ["spikes", 6, 4], ["tight", 8],
      ["coin", 6], ["ship", 32, 1], ["saws", 4], ["wave", 32, 1],
      ["orbs", 5], ["coin", 5], ["ball", 32], ["speed", 4],
      ["pillars", 5, 3], ["tight", 8], ["saws", 5], ["spikes", 6, 4],
      ["coin", 3], ["flat", 10],
    ],
  },
];

export function levelDef(n: number): LevelDef | undefined {
  return LEVELS.find((l) => l.n === n);
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  harder: "Harder",
  insane: "Insane",
  demon: "Demon",
};

export const DIFFICULTY_TONE: Record<Difficulty, string> = {
  easy: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  normal: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  hard: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  harder: "text-orange-300 border-orange-400/30 bg-orange-400/10",
  insane: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  demon: "text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/10",
};

/** Levels beyond the first unlock as you clear the one before. */
export function isLevelUnlocked(n: number, cleared: number[]): boolean {
  if (n <= 1) return true;
  return cleared.includes(n - 1);
}

/* ---------------------------------------------------------------- cosmetics */

export type ItemKind = "icon" | "ship" | "ball" | "wave" | "trail" | "death" | "colors";

export type ColorPair = { primary: string; secondary: string };

export const COLOR_PAIRS: Record<string, ColorPair> = {
  "col-aurora": { primary: "#5eead4", secondary: "#fbbf24" },
  "col-ember": { primary: "#fb923c", secondary: "#7f1d1d" },
  "col-frost": { primary: "#93c5fd", secondary: "#f8fafc" },
  "col-toxic": { primary: "#a3e635", secondary: "#0a0a0a" },
  "col-royal": { primary: "#818cf8", secondary: "#fde68a" },
  "col-blood": { primary: "#ef4444", secondary: "#27272a" },
  "col-mono": { primary: "#f8fafc", secondary: "#cbd5e1" },
  "col-prime": { primary: "#e879f9", secondary: "#22d3ee" },
};

export function colorPair(slug: string | null | undefined): ColorPair {
  return COLOR_PAIRS[slug ?? ""] ?? COLOR_PAIRS["col-aurora"]!;
}

export const KIND_LABEL: Record<ItemKind, string> = {
  icon: "Cubes",
  ship: "Ships",
  ball: "Balls",
  wave: "Waves",
  trail: "Trails",
  death: "Death effects",
  colors: "Colours",
};

export const FEAT_LABEL: Record<string, string> = {
  clears: "levels cleared",
  coins: "secret coins collected",
  insane: "insane+ level cleared",
  allcoins: "level cleared with all 3 coins",
};

export function featText(feat: string): string {
  const [kind, n] = feat.split(":");
  const label = FEAT_LABEL[kind ?? ""] ?? kind;
  return `${n ?? 1} ${label}`;
}

/* ------------------------------------------------------------------ scoring */

/** Arcade score fed to the XP backend — completion and depth matter most. */
export function runScore(level: number, pct: number, coins: number): number {
  const clear = pct >= 100 ? 1200 + level * 260 : 0;
  return Math.round(clear + pct * (6 + level) + coins * 220);
}

export function coinBits(mask: number): [boolean, boolean, boolean] {
  return [(mask & 1) > 0, (mask & 2) > 0, (mask & 4) > 0];
}

export function coinCount(mask: number): number {
  return coinBits(mask).filter(Boolean).length;
}
