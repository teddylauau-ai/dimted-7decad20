/**
 * Nova Rift — Lumo's campaign game. Unlike the endless arcade titles this one
 * is built out of hand-designed levels with unlocks, stars and abilities that
 * arrive as you progress.
 *
 * Coordinates are in canvas pixels. FLOOR_Y is the top surface of ground.
 */

export const VIEW_W = 720;
export const VIEW_H = 400;
export const FLOOR_Y = 340;

export type Rect = { x: number; y: number; w: number; h: number };

export type LevelDef = {
  n: number;
  name: string;
  /** Beat this (ms) for the speed star. */
  parMs: number;
  width: number;
  /** Floor segments: everything else at floor height is a deadly pit. */
  ground: { x: number; w: number }[];
  platforms: Rect[];
  spikes: Rect[];
  /** Optional saw-like movers that slide horizontally. */
  movers?: { x: number; y: number; w: number; h: number; range: number; speed: number }[];
  shards: { x: number; y: number }[];
  pads?: { x: number; y: number }[];
  goalX: number;
};

const g = (x: number, w: number) => ({ x, w });
const p = (x: number, y: number, w: number, h = 18) => ({ x, y, w, h });
const spike = (x: number, w = 26) => ({ x, y: FLOOR_Y - 24, w, h: 24 });
const spikeOn = (x: number, y: number, w = 26) => ({ x, y: y - 24, w, h: 24 });
const s = (x: number, y: number) => ({ x, y });

export const LEVELS: LevelDef[] = [
  {
    n: 1,
    name: "First Light",
    parMs: 14000,
    width: 1900,
    ground: [g(0, 780), g(900, 1000)],
    platforms: [p(520, 250, 140), p(1180, 240, 140)],
    spikes: [spike(360)],
    shards: [s(560, 200), s(1230, 190), s(1700, 290)],
    goalX: 1800,
  },
  {
    n: 2,
    name: "Step Sequence",
    parMs: 18000,
    width: 2300,
    ground: [g(0, 520), g(640, 420), g(1180, 400), g(1700, 600)],
    platforms: [p(1090, 250, 110), p(1600, 230, 120), p(2030, 250, 130)],
    spikes: [spike(300), spike(760), spike(1300, 40)],
    shards: [s(680, 200), s(1140, 200), s(2080, 200)],
    goalX: 2230,
  },
  {
    n: 3,
    name: "Pad Runner",
    parMs: 20000,
    width: 2500,
    ground: [g(0, 600), g(760, 300), g(1200, 340), g(1660, 840)],
    platforms: [p(560, 190, 120), p(1080, 160, 120), p(1560, 170, 130), p(2100, 200, 150)],
    spikes: [spike(420), spike(880, 40), spike(1780), spike(1980)],
    pads: [s(300, FLOOR_Y - 10), s(1300, FLOOR_Y - 10)],
    shards: [s(600, 130), s(1120, 100), s(2160, 140)],
    goalX: 2430,
  },
  {
    n: 4,
    name: "Needle Gate",
    parMs: 24000,
    width: 2700,
    ground: [g(0, 460), g(600, 220), g(920, 200), g(1240, 260), g(1620, 1080)],
    platforms: [p(500, 230, 100), p(860, 200, 100), p(1180, 230, 100), p(2000, 220, 140), p(2320, 160, 140)],
    spikes: [spike(240), spike(1700, 46), spike(1900), spikeOn(2020, 220)],
    shards: [s(540, 180), s(900, 150), s(2380, 110)],
    goalX: 2630,
  },
  {
    n: 5,
    name: "Double Vision",
    parMs: 26000,
    width: 2900,
    ground: [g(0, 420), g(620, 160), g(980, 140), g(1320, 160), g(1720, 1180)],
    platforms: [p(420, 200, 90), p(800, 150, 90), p(1140, 110, 90), p(1500, 170, 100), p(2200, 200, 150), p(2520, 130, 150)],
    spikes: [spike(200), spike(1820, 40), spike(2020), spikeOn(2260, 200)],
    shards: [s(460, 150), s(1180, 60), s(2580, 80)],
    goalX: 2830,
  },
  {
    n: 6,
    name: "Sawline",
    parMs: 30000,
    width: 3100,
    ground: [g(0, 700), g(840, 420), g(1400, 380), g(1900, 1200)],
    platforms: [p(660, 240, 120), p(1300, 210, 120), p(1820, 230, 120), p(2400, 190, 140), p(2740, 250, 140)],
    spikes: [spike(360), spike(560), spike(2100), spike(2300, 44)],
    movers: [
      { x: 900, y: FLOOR_Y - 30, w: 30, h: 30, range: 260, speed: 150 },
      { x: 1980, y: FLOOR_Y - 30, w: 30, h: 30, range: 300, speed: 190 },
    ],
    shards: [s(700, 190), s(1360, 160), s(2800, 200)],
    goalX: 3030,
  },
  {
    n: 7,
    name: "Rift Ascent",
    parMs: 32000,
    width: 3200,
    ground: [g(0, 380), g(560, 180), g(2600, 600)],
    platforms: [
      p(360, 260, 100),
      p(820, 250, 100),
      p(1060, 180, 100),
      p(1300, 110, 100),
      p(1560, 170, 100),
      p(1820, 240, 110),
      p(2120, 180, 110),
      p(2380, 250, 120),
    ],
    spikes: [spike(180), spikeOn(1080, 180), spikeOn(2400, 250), spike(2760)],
    shards: [s(1340, 60), s(1860, 190), s(2160, 130)],
    goalX: 3120,
  },
  {
    n: 8,
    name: "Compression",
    parMs: 34000,
    width: 3400,
    ground: [g(0, 320), g(520, 140), g(820, 120), g(1120, 120), g(1420, 140), g(1760, 1640)],
    platforms: [p(320, 210, 90), p(660, 170, 90), p(960, 210, 90), p(1260, 160, 90), p(2000, 230, 120), p(2400, 170, 120), p(2800, 220, 130)],
    spikes: [spike(1900), spike(2100, 46), spikeOn(2420, 170), spike(2620), spike(3080, 50)],
    movers: [{ x: 2200, y: FLOOR_Y - 34, w: 34, h: 34, range: 320, speed: 220 }],
    shards: [s(700, 120), s(1300, 110), s(2860, 170)],
    goalX: 3330,
  },
  {
    n: 9,
    name: "Dash Protocol",
    parMs: 34000,
    width: 3600,
    ground: [g(0, 400), g(700, 200), g(1180, 180), g(1660, 200), g(2160, 1440)],
    platforms: [p(460, 240, 100), p(940, 220, 100), p(1420, 200, 100), p(1900, 230, 100), p(2600, 190, 140), p(3000, 240, 140)],
    spikes: [spike(220), spike(2300, 60), spike(2480), spikeOn(2620, 190), spike(3260, 60)],
    shards: [s(980, 170), s(1460, 150), s(3060, 190)],
    pads: [s(2400, FLOOR_Y - 10)],
    goalX: 3520,
  },
  {
    n: 10,
    name: "Iron Cadence",
    parMs: 38000,
    width: 3800,
    ground: [g(0, 340), g(560, 160), g(900, 140), g(1240, 140), g(1580, 160), g(1980, 1820)],
    platforms: [p(340, 200, 90), p(720, 160, 90), p(1060, 120, 90), p(1400, 160, 90), p(1740, 210, 100), p(2400, 200, 120), p(2820, 150, 120), p(3240, 210, 130)],
    spikes: [spike(2120), spike(2320, 50), spikeOn(2440, 200), spike(2620), spike(3060, 56), spike(3480)],
    movers: [
      { x: 2700, y: FLOOR_Y - 32, w: 32, h: 32, range: 300, speed: 240 },
      { x: 3300, y: FLOOR_Y - 32, w: 32, h: 32, range: 260, speed: 260 },
    ],
    shards: [s(1100, 70), s(1780, 160), s(3300, 160)],
    goalX: 3720,
  },
  {
    n: 11,
    name: "Voidwalk",
    parMs: 40000,
    width: 4000,
    ground: [g(0, 300), g(3600, 400)],
    platforms: [
      p(280, 250, 90),
      p(560, 200, 90),
      p(840, 150, 90),
      p(1120, 210, 90),
      p(1400, 260, 90),
      p(1680, 200, 90),
      p(1960, 140, 90),
      p(2240, 200, 90),
      p(2520, 250, 90),
      p(2800, 190, 90),
      p(3080, 140, 90),
      p(3360, 220, 100),
    ],
    spikes: [spikeOn(600, 200), spikeOn(1720, 200), spikeOn(2560, 250), spike(3700, 60)],
    shards: [s(880, 100), s(2000, 90), s(3120, 90)],
    goalX: 3920,
  },
  {
    n: 12,
    name: "Nova Core",
    parMs: 46000,
    width: 4400,
    ground: [g(0, 320), g(520, 140), g(860, 120), g(1200, 120), g(1540, 1000), g(2700, 1700)],
    platforms: [
      p(320, 200, 90),
      p(700, 160, 90),
      p(1040, 120, 90),
      p(1380, 170, 90),
      p(1800, 230, 110),
      p(2100, 170, 110),
      p(2400, 240, 110),
      p(3000, 200, 120),
      p(3400, 150, 120),
      p(3800, 210, 130),
    ],
    spikes: [
      spike(1680),
      spike(1900, 50),
      spikeOn(2120, 170),
      spike(2900),
      spike(3120, 56),
      spikeOn(3420, 150),
      spike(3620),
      spike(4080, 60),
    ],
    movers: [
      { x: 2200, y: FLOOR_Y - 34, w: 34, h: 34, range: 340, speed: 250 },
      { x: 3200, y: FLOOR_Y - 34, w: 34, h: 34, range: 320, speed: 280 },
      { x: 3900, y: FLOOR_Y - 34, w: 34, h: 34, range: 280, speed: 300 },
    ],
    shards: [s(1080, 70), s(2140, 120), s(3860, 160)],
    goalX: 4320,
  },
];

export const TOTAL_STARS = LEVELS.length * 3;

/** Abilities arrive as the campaign opens up — this is the progression hook. */
export type Ability = "double-jump" | "dash";

export function abilitiesFor(level: number): Ability[] {
  const out: Ability[] = [];
  if (level >= 5) out.push("double-jump");
  if (level >= 9) out.push("dash");
  return out;
}

export function abilityNote(level: number): string | null {
  if (level === 5) return "Double Jump unlocked — tap jump again mid-air.";
  if (level === 9) return "Dash unlocked — press Shift to burst forward.";
  return null;
}

/** Stars: 1 for clearing, +1 for every shard, +1 for beating par. */
export function starsFor(level: LevelDef, shards: number, ms: number): number {
  let n = 1;
  if (shards >= level.shards.length) n += 1;
  if (ms <= level.parMs) n += 1;
  return n;
}

/** Campaign score fed to the XP reward curve. */
export function levelScore(level: LevelDef, stars: number, ms: number): number {
  const speedBonus = Math.max(0, Math.round((level.parMs - ms) / 100));
  return level.n * 120 + stars * 260 + speedBonus;
}

// ---------------------------------------------------------------- Arcade mastery

export type MasteryTier = { name: string; at: number };

const TIER_NAMES = ["Rookie", "Runner", "Adept", "Veteran", "Ace", "Nova"] as const;

/**
 * Endless arcade games get progression too: your personal best converts into a
 * mastery rank per game, and mastery ranks unlock the later games.
 */
export function masteryFor(best: number, xpPerScore: number): {
  rank: number;
  name: string;
  next: number | null;
  progress: number;
} {
  // Thresholds scale with each game's own scoring range.
  const unit = Math.max(40, Math.round(xpPerScore / 4));
  const steps = [0, unit, unit * 3, unit * 7, unit * 14, unit * 26];
  let rank = 0;
  for (let i = 0; i < steps.length; i++) if (best >= steps[i]!) rank = i;
  const next = rank < steps.length - 1 ? steps[rank + 1]! : null;
  const floor = steps[rank]!;
  const progress = next ? Math.min(1, (best - floor) / (next - floor)) : 1;
  return { rank, name: TIER_NAMES[rank]!, next, progress };
}

/** How many mastery ranks you must own before a game opens up. */
export const UNLOCK_AT: Record<string, number> = {
  "nova-blocks": 0,
  "pulse-grid": 0,
  "nova-rift": 0,
  "aurora-drift": 2,
  "signal-type": 4,
  "nova-fusion": 6,
  "spectre-dash": 9,
  "prism-break": 12,
  "comet-sling": 16,
};
