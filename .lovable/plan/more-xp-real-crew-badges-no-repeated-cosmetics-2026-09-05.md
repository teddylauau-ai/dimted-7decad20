# More XP, real crew badges, no repeated cosmetics

Three changes: new honest ways to earn XP, proper crew crest artwork instead of the words "Legend / Apex / Centurion", and unique art for every cosmetic so season rewards stop looking identical to shop items.

## 1. New ways to earn XP

All amounts are enforced in the database (never client-side), scale with level like existing awards, and are listed truthfully on the login page and Home.

**Daily streak bonus**
- One claimable bonus per day, granted the first time you do anything that earns XP.
- Day 1 = 120 XP, growing to a cap of 600 XP at a 14-day streak. Miss a day and the streak resets to day 1.
- Shown on Home as "Day X streak - next login pays Y XP".

**Achievements (one-off milestones)**
- A new Achievements panel with roughly 20 milestones across the app, each paying a single lump of XP plus Sparks:
  - Chat: 50 / 500 / 2000 messages sent, 10 replies received, first voice note, first image.
  - Social: 1 / 5 / 20 friends, join a crew, reach Friendship Level 5.
  - Pulse Rush: first clear, 10 levels cleared, all 27 cleared, a 100% run.
  - Skyward: 50 gates in one run, 25 runs, best score above a threshold.
  - Study: 100% on a quiz deck, three decks mastered.
- Progress is computed from existing data, so anything already done unlocks straight away. Each achievement pays once, tracked in a new table.

**Study, Pulse and Skyward extras**
- Study quizzes: XP for each new mastery percentage record on a deck (better result = the difference is paid), so replaying a mastered deck cannot be farmed.
- Pulse Rush: a first-clear bonus per level, growing with level number.
- Skyward: XP for completing each mission, once per mission.

## 2. Real crew badges (crew-only set)

- Replace the plain text "Legend", "Apex", "Centurion" tags with drawn crest chips: a glyph inside a shaped, tinted ring with its own glow, matching how personal shop badges read next to a name.
- Crew-only crest set unlocking on the crew ladder: Ember (L6), Tide (L12), Pulse (L18), Legend (L25), Apex (L30), Aurora (L35), Eclipse (L55), Sovereign (L80), Centurion (L100). Artwork is drawn fresh - none of it reuses shop badge art.
- The crest appears everywhere a crew name appears: crew header, crew ladder, dashboard, invites, and beside members' names in crew chat.
- The Rewards tab shows each crest as a live preview instead of a text label, so what is advertised is exactly what appears.

## 3. No repeated cosmetics

Audit found real duplicates - the Season 1 Corona frame uses exactly the same art as the shop Prismatic frame, and several season nametags/effects reuse shop art (Signal = Glacier, Vector = Neon, Apex = Solar, S1 Halo = Neon frame, and several message effects).

Fix:
- Give every Season 1 reward its own unique visual (new gradients, ring treatments and animations) so no season item matches a shop item.
- De-duplicate the shop itself: badges currently sharing a glyph (comet, gem, crown, star, seal) each get a distinct glyph, and repeated message effects get their own animation.
- Add a build-time check so two cosmetics can never ship with identical art again.

## Technical notes

- New tables: `daily_streaks` (or streak columns on `profiles`), `achievements` catalogue + `achievement_claims`, all with GRANTs and RLS scoped to `auth.uid()`.
- XP paid through the existing `award_xp` path so it also feeds season and crew pools, with the same server caps already in place.
- Crest rendering extends `BadgeMark` in `src/components/dimted/Identity.tsx` with a crew variant; unlock gates live in `crewPerkFlags()` in `src/lib/crews.ts`.
- Cosmetic art lives in `src/lib/cosmetics.ts` + CSS classes; the duplicate check is a small script asserting unique class strings and glyphs per slot.
