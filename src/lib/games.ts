/**
 * Dimted Arcade — real, playable minigames. Nothing here needs a chat partner,
 * a Realm, or a turn from someone else: you press start and you play.
 */
export type GameId = "nova-blocks" | "aurora-drift" | "pulse-grid";

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
];

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
