/**
 * NOVA VANGUARD — Dimted's flagship game.
 *
 * A hand-built action platformer campaign: you pick a level from the grid,
 * drop in with the weapon and gear you've unlocked, and fight through
 * drones, turrets, walkers and bosses to the extraction gate.
 *
 * Everything here is pure data + maths so the engine component stays readable
 * and the armory UI can describe items without duplicating strings.
 */

export const VIEW_W = 760;
export const VIEW_H = 430;
export const FLOOR_Y = 356;

export type Rect = { x: number; y: number; w: number; h: number };

export type EnemyKind = "drone" | "turret" | "walker" | "boss";

export type EnemySpawn = {
  kind: EnemyKind;
  x: number;
  y: number;
  /** drones patrol horizontally across this range */
  range?: number;
};

export type LevelDef = {
  n: number;
  name: string;
  brief: string;
  /** Beat this (ms) for the speed star. */
  parMs: number;
  width: number;
  /** Ground segments — anything else at floor height is a lethal pit. */
  ground: { x: number; w: number }[];
  platforms: Rect[];
  spikes: Rect[];
  enemies: EnemySpawn[];
  cores: { x: number; y: number }[];
  /** Levels ending in a boss don't open the gate until the boss is down. */
  boss?: boolean;
  goalX: number;
};

const g = (x: number, w: number) => ({ x, w });
const p = (x: number, y: number, w: number, h = 18) => ({ x, y, w, h });
const spike = (x: number, w = 28) => ({ x, y: FLOOR_Y - 22, w, h: 22 });
const spikeOn = (x: number, y: number, w = 28) => ({ x, y: y - 22, w, h: 22 });
const c = (x: number, y: number) => ({ x, y });
const drone = (x: number, y: number, range = 140): EnemySpawn => ({ kind: "drone", x, y, range });
const turret = (x: number, y = FLOOR_Y - 30): EnemySpawn => ({ kind: "turret", x, y });
const walker = (x: number, y = FLOOR_Y - 30, range = 180): EnemySpawn => ({
  kind: "walker",
  x,
  y,
  range,
});
const boss = (x: number, y = FLOOR_Y - 96): EnemySpawn => ({ kind: "boss", x, y });

export const LEVELS: LevelDef[] = [
  {
    n: 1,
    name: "Cold Open",
    brief: "Learn the rifle. Nothing here shoots back yet.",
    parMs: 26000,
    width: 2000,
    ground: [g(0, 900), g(1020, 1000)],
    platforms: [p(560, 250, 150), p(1240, 240, 150)],
    spikes: [spike(420)],
    enemies: [drone(700, 210, 120), drone(1400, 200, 160)],
    cores: [c(600, 200), c(1300, 190), c(1800, 300)],
    goalX: 1920,
  },
  {
    n: 2,
    name: "Turret Row",
    brief: "Static guns. Break line of sight, then punish.",
    parMs: 34000,
    width: 2400,
    ground: [g(0, 700), g(820, 620), g(1560, 900)],
    platforms: [p(720, 250, 120), p(1450, 240, 130), p(1980, 230, 150)],
    spikes: [spike(520), spikeOn(1460, 240, 40)],
    enemies: [turret(640), drone(1000, 200, 150), turret(1700), walker(2050)],
    cores: [c(760, 200), c(1500, 190), c(2020, 180), c(2250, 300)],
    goalX: 2330,
  },
  {
    n: 3,
    name: "Drop Shaft",
    brief: "Gaps everywhere. Drones own the air between them.",
    parMs: 38000,
    width: 2600,
    ground: [g(0, 520), g(660, 380), g(1140, 340), g(1620, 980)],
    platforms: [p(560, 240, 110), p(1060, 220, 110), p(1520, 250, 120), p(2100, 230, 140)],
    spikes: [spike(300), spike(760), spikeOn(1080, 220, 34)],
    enemies: [drone(600, 180, 130), drone(1200, 170, 180), walker(1800), drone(2200, 190, 200)],
    cores: [c(580, 190), c(1090, 170), c(1560, 200), c(2400, 300)],
    goalX: 2520,
  },
  {
    n: 4,
    name: "Warden",
    brief: "First boss. It hovers, sprays, and slams the ground.",
    parMs: 52000,
    width: 1700,
    ground: [g(0, 1700)],
    platforms: [p(300, 250, 130), p(760, 220, 150), p(1240, 250, 130)],
    spikes: [spike(600), spike(1080)],
    enemies: [turret(200), boss(1300)],
    cores: [c(340, 200), c(820, 170), c(1280, 200)],
    boss: true,
    goalX: 1620,
  },
  {
    n: 5,
    name: "Skylace",
    brief: "Platform ladder over a long pit. Don't rush the jumps.",
    parMs: 42000,
    width: 2800,
    ground: [g(0, 440), g(1980, 820)],
    platforms: [
      p(500, 300, 120),
      p(760, 250, 110),
      p(1020, 200, 110),
      p(1300, 250, 120),
      p(1580, 300, 120),
      p(1820, 240, 130),
    ],
    spikes: [spikeOn(1040, 200, 30), spike(2200)],
    enemies: [drone(700, 180, 160), drone(1200, 150, 200), turret(2100), walker(2450)],
    cores: [c(540, 250), c(1050, 150), c(1620, 250), c(2600, 300)],
    goalX: 2720,
  },
  {
    n: 6,
    name: "Crossfire",
    brief: "Turrets above and below. Movement is the only cover.",
    parMs: 46000,
    width: 3000,
    ground: [g(0, 900), g(1050, 700), g(1900, 1100)],
    platforms: [p(520, 230, 140), p(1150, 200, 140), p(1720, 240, 130), p(2320, 210, 150)],
    spikes: [spike(700), spike(1300), spikeOn(1740, 240, 36)],
    enemies: [
      turret(560, 200),
      walker(800),
      turret(1180, 170),
      drone(1500, 170, 180),
      turret(2100),
      walker(2500),
    ],
    cores: [c(600, 180), c(1220, 150), c(1780, 190), c(2400, 160), c(2850, 300)],
    goalX: 2930,
  },
  {
    n: 7,
    name: "Spine",
    brief: "Tight corridors, walkers charging both ways.",
    parMs: 48000,
    width: 3000,
    ground: [g(0, 640), g(760, 560), g(1440, 520), g(2060, 940)],
    platforms: [p(660, 260, 110), p(1340, 230, 120), p(1980, 250, 120), p(2500, 210, 140)],
    spikes: [spike(400), spike(1000), spike(1600), spikeOn(2520, 210, 36)],
    enemies: [walker(500), walker(900), drone(1300, 160, 200), walker(1900), turret(2400, 180)],
    cores: [c(680, 210), c(1360, 180), c(2020, 200), c(2560, 160)],
    goalX: 2920,
  },
  {
    n: 8,
    name: "Colossus",
    brief: "Second boss. Faster, bigger, brings friends.",
    parMs: 62000,
    width: 1900,
    ground: [g(0, 1900)],
    platforms: [p(260, 240, 140), p(720, 200, 160), p(1220, 240, 140)],
    spikes: [spike(560), spike(1060)],
    enemies: [turret(180, 190), drone(700, 160, 200), boss(1500)],
    cores: [c(300, 190), c(780, 150), c(1260, 190)],
    boss: true,
    goalX: 1820,
  },
  {
    n: 9,
    name: "Freefall",
    brief: "Almost no floor. Everything is a platform, everything shoots.",
    parMs: 52000,
    width: 3200,
    ground: [g(0, 380), g(2860, 340)],
    platforms: [
      p(460, 300, 110),
      p(720, 250, 100),
      p(980, 200, 100),
      p(1240, 260, 110),
      p(1520, 220, 100),
      p(1800, 280, 110),
      p(2080, 230, 110),
      p(2380, 190, 120),
      p(2620, 250, 120),
    ],
    spikes: [spikeOn(1000, 200, 30), spikeOn(2100, 230, 30)],
    enemies: [
      drone(620, 170, 180),
      turret(1260, 230),
      drone(1600, 150, 200),
      turret(2100, 200),
      drone(2500, 150, 220),
    ],
    cores: [c(500, 250), c(1010, 150), c(1560, 170), c(2420, 140), c(3000, 300)],
    goalX: 3120,
  },
  {
    n: 10,
    name: "Ironworks",
    brief: "A gauntlet. Six kinds of pressure, no safe pause.",
    parMs: 58000,
    width: 3400,
    ground: [g(0, 780), g(900, 620), g(1660, 560), g(2380, 1020)],
    platforms: [p(560, 240, 130), p(1180, 200, 130), p(1780, 250, 130), p(2500, 210, 150), p(2900, 260, 140)],
    spikes: [spike(600), spike(1200), spike(1900), spikeOn(2520, 210, 36), spike(3100)],
    enemies: [
      walker(400),
      turret(620, 190),
      drone(1000, 160, 180),
      walker(1400),
      turret(1820, 200),
      drone(2100, 150, 220),
      walker(2700),
      turret(3050),
    ],
    cores: [c(600, 190), c(1240, 150), c(1840, 200), c(2560, 160), c(2960, 210)],
    goalX: 3320,
  },
  {
    n: 11,
    name: "Nightfall",
    brief: "The hardest run before the end. Bring your best gear.",
    parMs: 64000,
    width: 3600,
    ground: [g(0, 520), g(700, 420), g(1300, 380), g(1860, 420), g(2500, 1100)],
    platforms: [
      p(560, 260, 110),
      p(1140, 210, 110),
      p(1700, 250, 120),
      p(2260, 200, 120),
      p(2800, 250, 130),
      p(3150, 200, 140),
    ],
    spikes: [spike(300), spike(1000), spike(1600), spike(2200), spikeOn(2820, 250, 36)],
    enemies: [
      drone(600, 170, 160),
      walker(800),
      turret(1180, 180),
      drone(1500, 150, 200),
      walker(2000),
      turret(2320, 170),
      drone(2700, 150, 220),
      walker(3100),
    ],
    cores: [c(580, 210), c(1180, 160), c(1760, 200), c(2320, 150), c(2860, 200), c(3400, 300)],
    goalX: 3520,
  },
  {
    n: 12,
    name: "Prime",
    brief: "Final boss. Three phases. No checkpoints. Good luck.",
    parMs: 80000,
    width: 2100,
    ground: [g(0, 2100)],
    platforms: [p(220, 250, 150), p(640, 200, 160), p(1120, 240, 150), p(1560, 200, 150)],
    spikes: [spike(520), spike(1000), spike(1480)],
    enemies: [turret(160, 200), drone(760, 150, 200), turret(1300, 190), boss(1750)],
    cores: [c(260, 200), c(700, 150), c(1180, 190), c(1620, 150)],
    boss: true,
    goalX: 2020,
  },
];

export function levelDef(n: number): LevelDef | undefined {
  return LEVELS.find((l) => l.n === n);
}

/* ---------------------------------------------------------------- weapons */

export type WeaponSlug =
  | "pulse-rifle"
  | "scatter-coil"
  | "arc-lance"
  | "nova-cannon"
  | "void-ribbon";

export type WeaponDef = {
  slug: WeaponSlug;
  name: string;
  blurb: string;
  price: number;
  rarity: string;
  /** ms between shots */
  cooldown: number;
  damage: number;
  speed: number;
  /** shots per trigger pull */
  pellets: number;
  spread: number;
  /** bolt passes through enemies */
  pierce: boolean;
  /** bolt curves toward the closest enemy */
  homing: boolean;
  /** explodes on hit, splashing this radius */
  splash: number;
  color: string;
};

export const WEAPONS: WeaponDef[] = [
  {
    slug: "pulse-rifle",
    name: "Pulse Rifle",
    blurb: "Reliable rapid single shot. Always yours.",
    price: 0,
    rarity: "common",
    cooldown: 190,
    damage: 10,
    speed: 0.72,
    pellets: 1,
    spread: 0,
    pierce: false,
    homing: false,
    splash: 0,
    color: "#5eead4",
  },
  {
    slug: "scatter-coil",
    name: "Scatter Coil",
    blurb: "Three-shot spread. Shreds anything up close.",
    price: 120,
    rarity: "uncommon",
    cooldown: 330,
    damage: 8,
    speed: 0.6,
    pellets: 3,
    spread: 0.22,
    pierce: false,
    homing: false,
    splash: 0,
    color: "#a3e635",
  },
  {
    slug: "arc-lance",
    name: "Arc Lance",
    blurb: "Piercing beam bolt that punches through a whole line.",
    price: 260,
    rarity: "rare",
    cooldown: 420,
    damage: 18,
    speed: 1.05,
    pellets: 1,
    spread: 0,
    pierce: true,
    homing: false,
    splash: 0,
    color: "#60a5fa",
  },
  {
    slug: "nova-cannon",
    name: "Nova Cannon",
    blurb: "Slow charge, huge blast radius.",
    price: 520,
    rarity: "epic",
    cooldown: 620,
    damage: 26,
    speed: 0.46,
    pellets: 1,
    spread: 0,
    pierce: false,
    homing: false,
    splash: 62,
    color: "#fb923c",
  },
  {
    slug: "void-ribbon",
    name: "Void Ribbon",
    blurb: "Homing ribbons that curve into whatever is nearest.",
    price: 900,
    rarity: "legendary",
    cooldown: 240,
    damage: 12,
    speed: 0.55,
    pellets: 2,
    spread: 0.5,
    pierce: false,
    homing: true,
    splash: 0,
    color: "#e879f9",
  },
];

export type GearSlug =
  | "dash-core"
  | "kinetic-plate"
  | "magnet-field"
  | "phase-boots"
  | "siphon-lattice";

export type GearDef = {
  slug: GearSlug;
  name: string;
  blurb: string;
  price: number;
  rarity: string;
};

export const GEAR: GearDef[] = [
  {
    slug: "dash-core",
    name: "Dash Core",
    blurb: "Shift / double-tap to burst dash straight through bullets.",
    price: 150,
    rarity: "uncommon",
  },
  {
    slug: "kinetic-plate",
    name: "Kinetic Plate",
    blurb: "One extra hit point every run.",
    price: 220,
    rarity: "rare",
  },
  {
    slug: "magnet-field",
    name: "Magnet Field",
    blurb: "Cores fly to you from across the room.",
    price: 180,
    rarity: "uncommon",
  },
  {
    slug: "phase-boots",
    name: "Phase Boots",
    blurb: "Double jump, and you fall a little softer.",
    price: 400,
    rarity: "epic",
  },
  {
    slug: "siphon-lattice",
    name: "Siphon Lattice",
    blurb: "Every eighth kill stitches a hit point back on.",
    price: 600,
    rarity: "legendary",
  },
];

export function weaponBySlug(slug: string | null | undefined): WeaponDef {
  return WEAPONS.find((w) => w.slug === slug) ?? WEAPONS[0]!;
}

export function gearBySlug(slug: string | null | undefined): GearDef | null {
  return GEAR.find((g2) => g2.slug === slug) ?? null;
}

export type RunResult = {
  cleared: boolean;
  ms: number;
  stars: number;
  kills: number;
  coresCollected: number;
  coresEarned: number;
  noDamage: boolean;
  underPar: boolean;
};

/** Stars: clear it, clear it clean, clear it fast. */
export function scoreRun(level: LevelDef, ms: number, damageTaken: number): {
  stars: number;
  noDamage: boolean;
  underPar: boolean;
} {
  const noDamage = damageTaken === 0;
  const underPar = ms <= level.parMs;
  return { stars: 1 + (noDamage ? 1 : 0) + (underPar ? 1 : 0), noDamage, underPar };
}

export function coresFor(level: LevelDef, kills: number, collected: number, stars: number): number {
  return Math.min(400, kills * 5 + collected * 8 + stars * 14 + level.n * 3);
}

/** Score sent to the arcade XP function — bigger runs, bigger XP. */
export function runScore(level: LevelDef, stars: number, kills: number, ms: number): number {
  const speed = Math.max(0, Math.round((level.parMs - ms) / 100));
  return level.n * 220 + stars * 400 + kills * 60 + speed;
}
