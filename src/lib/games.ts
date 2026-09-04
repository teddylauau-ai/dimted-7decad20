/**
 * Lumo Arcade — real, playable minigames. Nothing here needs a chat partner
 * or a turn from someone else: you press start and you play.
 */
export type GameId =
  | "nova-blocks"
  | "aurora-drift"
  | "pulse-grid"
  | "spectre-dash"
  | "prism-break"
  | "comet-sling"
  | "nova-fusion"
  | "signal-type";

export type GameDef = {
  id: GameId;
  name: string;
  tagline: string;
  how: string;
  controls: string;
  /** Score is divided by this to work out XP, capped by the backend anyway. */
  xpPerScore: number;
};

export const GAMES: GameDef[] = [
  {
    id: "nova-blocks",
    name: "Nova Blocks",
    tagline: "Stack, rotate, clear. Speeds up until you crack.",
    how: "Falling shapes drop faster every level. Fill a full row to clear it — four at once is a Nova.",
    controls: "← → move · ↑ rotate · ↓ soft drop · Space hard drop",
    xpPerScore: 400,
  },
  {
    id: "aurora-drift",
    name: "Aurora Drift",
    tagline: "Thread a glider through collapsing light.",
    how: "Steer through the gaps, grab motes for combo. One hit ends the run.",
    controls: "← → or A / D · or move your mouse",
    xpPerScore: 300,
  },
  {
    id: "pulse-grid",
    name: "Pulse Grid",
    tagline: "Pure reaction. Hit the light before it dies.",
    how: "Tiles pulse for a shrinking window. Chain hits to build a multiplier. Three misses and you're out.",
    controls: "Click or tap the lit tile",
    xpPerScore: 250,
  },
  {
    id: "spectre-dash",
    name: "Spectre Dash",
    tagline: "One button. Spikes. No mercy.",
    how: "Your cube auto-runs and speeds up forever. Tap to jump, land on blocks, hit gold pads for a launch, touch a spike and it's over. Score is distance.",
    controls: "Space / tap to jump",
    xpPerScore: 120,
  },
  {
    id: "prism-break",
    name: "Prism Break",
    tagline: "Break the wall of light before it breaks you.",
    how: "Steer the paddle, keep the ball alive. Gold bricks take two hits, each cleared wave speeds things up. Three balls.",
    controls: "Move mouse or ← → / A D",
    xpPerScore: 400,
  },
  {
    id: "comet-sling",
    name: "Comet Sling",
    tagline: "Hold the core against a collapsing sky.",
    how: "Aim with the pointer, hold to fire. Big comets split into two fast ones. Three leaks into the core and you're done.",
    controls: "Aim with pointer · hold to fire",
    xpPerScore: 350,
  },
  {
    id: "nova-fusion",
    name: "Nova Fusion",
    tagline: "Slide, merge, double, repeat.",
    how: "Push the grid and fuse matching cores. Every merge pays its own value. Run out of legal moves and the board locks.",
    controls: "Arrows / WASD / swipe",
    xpPerScore: 500,
  },
  {
    id: "signal-type",
    name: "Signal Type",
    tagline: "45 seconds of incoming transmissions.",
    how: "Type each word and hit space. Clean streaks build up to an ×8 multiplier; one typo resets it.",
    controls: "Type · space or enter to send",
    xpPerScore: 400,
  },
];

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
