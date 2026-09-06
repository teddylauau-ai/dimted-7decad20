/**
 * Lazu Arcade — real, playable minigames. Nothing here needs a chat partner
 * or a turn from someone else: you press start and you play.
 */
export type GameId =
  | "nova-blocks"
  | "aurora-drift"
  | "prism-break"
  | "comet-sling"
  | "nova-fusion"
  | "tower-stack"
  | "lane-hop"
  | "neon-coil";

export type GameDef = {
  id: GameId;
  name: string;
  tagline: string;
  how: string;
  controls: string;
  /** Score is divided by this to work out XP, capped by the backend anyway. */
  xpPerScore: number;
  /** A solid run for this game. XP is normalised against it server-side. */
  xpPar: number;
  /** Effort tilt: longer/harder games pay a little more per good run. */
  xpWeight: number;
};

export const GAMES: GameDef[] = [
  {
    id: "nova-blocks",
    name: "Nova Blocks",
    tagline: "Stack, rotate, clear. Speeds up until you crack.",
    how: "Falling shapes drop faster every level. Fill a full row to clear it — four at once is a Nova.",
    controls: "← → move · ↑ rotate · ↓ soft drop · Space hard drop",
    xpPerScore: 400,
    xpPar: 900,
    xpWeight: 1.20,
  },
  {
    id: "aurora-drift",
    name: "Aurora Drift",
    tagline: "Thread a glider through collapsing light.",
    how: "Steer through the gaps, grab motes for combo. One hit ends the run.",
    controls: "← → or A / D · or move your mouse",
    xpPerScore: 300,
    xpPar: 6000,
    xpWeight: 0.90,
  },
  {
    id: "prism-break",
    name: "Prism Break",
    tagline: "Break the wall of light before it breaks you.",
    how: "Steer the paddle, keep the ball alive. Gold bricks take two hits, each cleared wave speeds things up. Three balls.",
    controls: "Move mouse or ← → / A D",
    xpPerScore: 400,
    xpPar: 4000,
    xpWeight: 1.10,
  },
  {
    id: "comet-sling",
    name: "Comet Sling",
    tagline: "Hold the core against a collapsing sky.",
    how: "Aim with the pointer, hold to fire. Big comets split into two fast ones. Three leaks into the core and you're done.",
    controls: "Aim with pointer · hold to fire",
    xpPerScore: 350,
    xpPar: 12000,
    xpWeight: 1.00,
  },
  {
    id: "nova-fusion",
    name: "Nova Fusion",
    tagline: "Slide, merge, double, repeat.",
    how: "Push the grid and fuse matching cores. Every merge pays its own value. Run out of legal moves and the board locks.",
    controls: "Arrows / WASD / swipe",
    xpPerScore: 500,
    xpPar: 3000,
    xpWeight: 1.15,
  },
  {
    id: "tower-stack",
    name: "Tower Stack",
    tagline: "One tap. One slab. Don't get sloppy.",
    how: "A slab slides above your tower — drop it as square as you can. Overhang gets sliced off, so every messy drop shrinks the next one. Perfect drops regrow width and pay a combo.",
    controls: "Space / tap to drop",
    xpPerScore: 350,
    xpPar: 2500,
    xpWeight: 0.95,
  },
  {
    id: "lane-hop",
    name: "Lane Hop",
    tagline: "Cross the traffic. Ride the light rafts.",
    how: "Hop forward lane by lane. Roads kill on contact, rivers of light only carry you if you land on a raft. Traffic speeds up the deeper you get.",
    controls: "W / up to hop, A D to sidestep, tap or swipe",
    xpPerScore: 280,
    xpPar: 220,
    xpWeight: 0.95,
  },
  {
    id: "neon-coil",
    name: "Neon Coil",
    tagline: "Snake with portals and drifting mines.",
    how: "Eat cores to grow. Edges wrap around, so there are no walls, but every few cores drops a mine on the board.",
    controls: "Arrows / WASD / swipe",
    xpPerScore: 320,
    xpPar: 1800,
    xpWeight: 1.00,
  },
];

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Mirrors award_arcade_xp: normalised by par, tilted by weight. */
export function expectedXp(game: GameDef, score: number): number {
  const ratio = Math.min(4, Math.max(0, score) / game.xpPar);
  return Math.min(950, Math.round((70 + 470 * Math.sqrt(ratio)) * game.xpWeight));
}

/** XP for a solid (par) run — the number used to rank games in the hub. */
export function parXp(game: GameDef): number {
  return expectedXp(game, game.xpPar);
}

/** Games ordered by how much XP a good run pays, richest first. */
export function gamesByXp(): GameDef[] {
  return [...GAMES].sort((a, b) => parXp(b) - parXp(a));
}
