# DIMTED: sign-up gate, Discord-style comfort, nametags + cosmetic shop

## 1. Fix the broken build first

The sign-in gate I added last turn shipped with a type error in the sidebar
(`AppShell.tsx` line 103 — a leftover unread-badge spread that no longer has a value).
That single error is why no account prompt appears: the app can't compile, so the
auth screen never renders. Removing the dead badge block restores the sign-up screen
you were expecting.

## 2. Make it feel like Discord, not "AI generic"

Keep the Midnight Aurora palette, but rebuild the shell into a familiar, ergonomic layout:

```text
┌────┬──────────────┬───────────────────────────┬──────────┐
│ 72 │ channel /    │  content (chat, feed)     │ member / │
│ px │ conversation │                           │ detail   │
│rail│ list  240px  │                           │ 240px    │
└────┴──────────────┴───────────────────────────┴──────────┘
```

- Narrow left icon rail (communities + home + shop), rounded-square avatars, active pill indicator on the left edge.
- Second column: grouped, scannable lists (Conversations / Channels) with 32px rows.
- Chat gets Discord message grouping: avatar + name + timestamp on the first message, tight continuation lines after, hover row highlight, compact composer pinned to the bottom.
- Tighter type scale and consistent 4px spacing rhythm; fewer glowing gradient panels, less "showcase" copy, no oversized hero blocks on utility pages.
- Bottom-left account bar (avatar, name, level, mute/settings/sign-out) exactly where Discord puts it.
- Progression HUD moves into the account bar + a slim top bar, so it stops dominating every page.

## 3. Nametags and cosmetics

Cosmetics are worn on your name and profile everywhere your name appears (chat, member list, profile, discover):

- **Nametags** — name colour, gradient name, animated shimmer, bracketed frames.
- **Badges** — small icons next to the name.
- **Avatar frames** — rings and glows around the avatar.
- **Profile banners** — the header art on your profile.
- **Effects** — subtle entrance animation on your chat messages.

Each cosmetic has a rarity (common → mythic) and an unlock condition: a level requirement, an achievement, or a Sparks price.

## 4. The shop

The shop sells cosmetics for **Sparks**, an earned currency — never real money, and never anything that affects XP, energy, or standing. You earn Sparks by playing DIMTED (chatting, streaks, activities, levelling), with the same cooldowns/caps that protect XP from spam. This keeps the "everything is earned" rule intact while giving you a real place to spend and collect.

- Rotating featured row + full grid with rarity filters.
- Item cards show price, rarity, and a live preview of your name wearing it.
- Owned items go to your inventory; you equip one item per slot.
- Level-locked and achievement-locked items appear as mysterious locked tiles.

## 5. Other people's profiles — real accounts only

- New public profile page at `/u/<username>`: their level, rank, title, nametag, badges, banner, achievements, collection, community memberships, and mutual friends. Buttons to add friend or message.
- Every name and avatar in chat, member lists, friends, and discover becomes clickable and routes there.
- Discover only lists profiles that exist in the database. No invented people, no filler. If one person has signed up, Discover shows one person and says so plainly.

## 6. Empty states that read as intentional

Because there is no fake data, the first-run experience matters: each page gets a short, confident empty state that tells you the single next action (invite a friend, create a community, start an activity) instead of a blank panel.

---

## Technical notes

- Fix `AppShell.tsx:103`: drop the `{"badge" in rest ...}` block and the rest spread.
- Migration (one call, with GRANTs + RLS):
  - `profiles` gains `sparks int not null default 0`, `avatar_url text`, `banner text`, `nametag text`, `frame text`, plus `equipped` cosmetic columns.
  - `cosmetics` — catalogue table (slug, name, slot, rarity, price_sparks, required_level, css payload). Seeded with literal INSERTs in the migration.
  - `inventory` — (user_id, cosmetic_slug, acquired_at), unique per pair. Read own + read others' equipped items via a narrow policy.
  - `purchase_cosmetic(_slug text)` security-definer function: checks price, level gate, Sparks balance, and ownership atomically; the client never writes Sparks directly.
  - `award_xp` extended to also grant Sparks per event, under the existing cooldown/cap logic.
- New files: `src/routes/shop.tsx`, `src/routes/u.$username.tsx`, `src/components/dimted/Nametag.tsx`, `src/components/dimted/CosmeticPreview.tsx`, `src/components/dimted/MessageRow.tsx`, plus a rebuilt `AppShell` with the rail/list/content/aside layout.
- Cosmetic styling resolved through design tokens in `src/styles.css` (new rarity/nametag utilities), never hardcoded colours.
- Public profile route stays a top-level SSR route with its own `head()` for shareable links; it reads only safe columns.
- Each new route gets unique title/description/og tags.
