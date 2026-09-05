# Content & Polish Update

Goal: more to do, more to unlock, and chat that feels richer — focused on Pulse Rush, progression/shop, and social polish.

## 1. Pulse Rush — more content
- **6 new levels (16–21)**: two Hard, two Insane, two Demon, each with its own music-synced theme and geometry — extends the campaign past the current 15.
- **Daily Challenge level**: one hand-picked level rotates each day with a bonus coin reward for clearing it that day (tracked per-day so it can only be claimed once).
- **New cosmetics to chase**: ~10 new Pulse Rush skins (icons, trails, death effects) in the in-game locker, earned through coins and level feats.
- Every new level is solver-verified beatable with human timing before shipping (same check we run on existing levels).

## 2. Progression & shop — more to earn
- **More quests**: grow the quest board with new daily and weekly quests (play N Pulse levels, send voice messages, keep a streak, visit a friend’s profile, etc.).
- **More shop cosmetics**: a fresh batch of ~15 regular-pool items across nametags, badges, frames, banners and effects, feeding the daily/weekly rotations so the shelves genuinely change.
- **Collection milestones**: small Sparks rewards when your armory reaches ownership milestones (5 / 15 / 30 items), so collecting itself progresses.

## 3. Chat & social polish
- **Message reactions**: react to any DM or community message with a small set of emoji; reactions show under the message and update live.
- **Richer hover cards**: profile pop-ups also show Pulse Rush best clear and current win streak, so showing off is everywhere.
- **Chat quality-of-life**: “jump to latest” button when scrolled up, and message grouping polish.

## Technical notes
- New Pulse levels go in `src/lib/pulse.ts` (same authored-geometry format, solver check re-run).
- Reactions need one new table (`message_reactions` for DMs + community, with RLS + grants) — single migration.
- New cosmetics/quests are data inserts into existing `cosmetics` / `quests` / `pulse_items` tables.
- No changes to roles, vaults, or the leveling curve.

Nothing is purchasable with real money; everything above is earned by playing.
