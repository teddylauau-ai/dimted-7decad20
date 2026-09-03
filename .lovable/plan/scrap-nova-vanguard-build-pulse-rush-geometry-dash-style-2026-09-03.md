# Scrap Nova Vanguard → build PULSE RUSH (Geometry Dash style)

Nova Vanguard goes away completely. In its place: a one-button rhythm runner where you auto-run forward at constant speed and tap to jump, exactly the Geometry Dash loop — instant death, instant restart, memorise the level, nail the run.

## The game

- **One input.** Tap / click / space / up. Hold to chain jumps. That's it. Nothing floaty: fixed gravity arc, no air control, no momentum drift, so every failure feels like your mistake and every retry is fast.
- **Instant restart.** Death is a flash + shatter and you're back at the start in under half a second. No menus, no confirmation.
- **Beat-synced levels.** Obstacles are placed on a musical grid so the level has rhythm — spike, spike, gap, triple. Speed ramps at set portals.
- **Game modes inside a level** (the thing that makes Geometry Dash feel varied):
  - Cube — jump.
  - Ship — hold to fly up, release to fall, through tunnels.
  - Wave — hold for 45-degree up, release for down, tight corridors.
  - Ball — tap to flip gravity between floor and ceiling.
  - Speed portals, jump pads, jump orbs, gravity portals, moving saws.
- **Practice mode.** Place checkpoints, learn the level, no progress reward. Normal mode is the only thing that counts for completion.
- **Progress %.** Every attempt shows how far you got; the level card remembers your best percent, attempt count and whether you have full completion + coins.

## Levels

15 hand-built levels on a difficulty ladder, each with its own palette, obstacle vocabulary and mode mix:

1. Ignition (easy) → 5. Neon Drift (normal) → 9. Static Bloom (hard) → 12. Overdrive (harder) → 15. Dimted Prime (insane, demon-tier finale)

Each level hides **3 secret coins** in risky routes. Coins are the currency for unlocks and are required for the final level.

## Unlockable stuff (this is the collection hook)

Spent from coins + level completions, all persisted per account:

- **Icons** — cube skins (18): geometric, chrome, glitch, aurora, and a few Owner/level-gated ones.
- **Ship / ball / wave skins** (12) so every mode is customisable.
- **Trails** (10) — plasma, ember, stardust, void ribbon.
- **Death effects** (8) — shatter, implosion, pixel burst.
- **Colour pairs** — primary/secondary palette for your icon.
- Some items unlock by **feat**, not purchase: beat a level with all 3 coins, clear a level without dying twice, reach 100% on an insane level, hit an account level threshold. Those are the ones people actually chase.

## Rewards into DIMTED

Completions and coins award XP and Sparks through the existing arcade reward path, with the same cooldown/cap anti-spam rules. First clears award more than repeats; percent-record improvements award a small amount so grinding a hard level isn't dead time.

## Screens

- `/pulse` replaces `/vanguard` in the sidebar as the flagship game.
- **Level select** — cards in a grid with difficulty face, best %, coins collected, stars, attempt count, locked state.
- **Locker** — tabbed customisation (icon / ship / ball / wave / trail / death effect / colours) with a live rotating preview of your current cube, rarity styling, and clear "how to unlock" text on locked items.
- **In game** — clean HUD: progress bar with percent at the top, attempt counter, coin pips. Nothing overlapping the play area.

## Technical notes

- Delete `src/lib/vanguard.ts`, `src/lib/vanguard-queries.ts`, `src/components/games/NovaVanguard.tsx`, `src/routes/vanguard.tsx`; drop the nav entry.
- New: `src/lib/pulse.ts` (level data, obstacle/portal/mode types, cosmetics catalogue, scoring), `src/lib/pulse-queries.ts`, `src/components/games/PulseRush.tsx` (canvas engine), `src/routes/pulse.tsx` (level select + locker + run flow) with its own `head()` metadata.
- Engine: fixed-timestep simulation (deterministic — same level always plays identically), swept collision against axis-aligned obstacle rects and triangle spikes, camera locked to player X, offscreen-canvas parallax background.
- Persistence reuses the existing generic tables — `game_progress` (game `pulse-rush`, level, stars, best_ms), `game_unlocks` (owned cosmetics), and the existing cores/equip state row for currency and equipped loadout. Best-percent and coin flags go in a small migration that extends progress with `best_pct` and `coins` columns plus a `pulse_finish` RPC, with GRANTs and RLS scoped to the owning user.
- Existing Nova Vanguard rows/items are left in place but unused; no data loss for other games.
