# Look & feel refresh

## Goal
Make DIMTED feel more polished, cohesive, and premium without changing the core layout or navigation. Focus on the details that make the app feel alive: consistent surfaces, smoother motion, meaningful empty states, and a tighter home page.

## Proposed changes

### 1. Unified surface system
- Audit every card/panel and settle on one glass recipe: consistent border, radius, shadow, and hover lift.
- Replace one-off hardcoded styles in Home, Profile, Messages, Communities, Armory, and Pulse Rush with shared panel components.
- Add subtle inner highlight to top edges of panels so they read as glass rather than flat grey.

### 2. Motion & micro-interactions
- Add a shared page transition wrapper so route changes fade/slide instead of snapping.
- Upgrade buttons, tabs, and list items with press/hover/active states.
- Add loading skeletons for lists (friends, leaderboard, messages, shop) instead of generic spinners.
- Respect `prefers-reduced-motion` everywhere.

### 3. Empty states & first-run moments
- Replace "No friends", "No messages", "No quests", "No cosmetics" blank screens with illustrated empty states that explain what to do next.
- Add a quick "Get started" nudge on the home page for new players.

### 4. Home page polish
- Compress vertical spacing further and lock the visual hierarchy: level/rank card → friends strip → XP ladder → leaderboard → quests.
- Make the leaderboard row feel like a real ranking strip with rank medals and streak flames.
- Add a small "Now playing" pulse for friends in arcade.

### 5. Rank & presence polish
- Redesign rank badges as hexagonal/emblem shapes with tier colour coding.
- Ensure presence dots and status crosses are crisp and consistent at every size (avatar, message list, leaderboard).

### 6. New small feature: profile holo card
- Add a shareable profile card overlay users can open from any profile.
- Renders avatar, banner, rank badge, level, title, and equipped cosmetics as a single stylised card.
- Owner/admins see a "Manage user" shortcut from the card.

## Files likely touched
- `src/styles.css` — surface tokens, motion tokens, skeleton utility.
- `src/components/dimted/AppShell.tsx` — page transition wrapper.
- `src/components/dimted/Panel.tsx` (new or existing) — shared glass panel.
- `src/routes/index.tsx` — home layout, empty states, leaderboard strip.
- `src/routes/profile.tsx`, `src/routes/u.$username.tsx` — holo card trigger.
- `src/components/dimted/Identity.tsx` — presence dot sizing.
- `src/components/dimted/EmptyState.tsx` (new) — reusable empty state.

## Verification
- TypeScript passes.
- Screenshots of Home, Profile, Messages, and Armory show consistent surfaces and no layout regressions.
- Reduced-motion media query disables the new transitions.
