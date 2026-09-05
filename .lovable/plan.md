# Lazu Update Plan — Crews, Season Pass, Widget Profiles

## What we're building

1. **Crews** — invite-only squads (2–25 members) with their own private chat, shared XP pool, crew badge/tag, and crew-only cosmetics you can grant as Owner/Admin.
2. **Season Pass** — a free monthly progression track with 50 tiers. Players earn Season XP through play, quests, and chat. Rewards include Sparks, cosmetics, titles, and profile badges. Resets each month.
3. **Widget Profiles** — draggable profile layout where users can place widgets (Stats block, Spotify picks, Achievements, Showcase, Rank badge, Friends, Pulse Rush stats) on their public profile.

---

## 1. Crews

### Database
- `public.crews`: id, slug, name, tagline, badge_emoji, total_xp, owner_id, created_at, updated_at.
- `public.crew_members`: crew_id, user_id, role (owner/captain/member), joined_at.
- `public.crew_messages`: id, crew_id, user_id, body, created_at, reply_to_id, audio_url, audio_ms, image_url.
- `public.crew_invites`: id, crew_id, user_id, invited_by, created_at.
- Grants + RLS: members read/write their crew messages; owners/captains manage invites/kick; public crews visible to all, private crews only via invite.

### Features
- Create/join/leave crew, invite by username, accept/decline invite.
- Crew chat with replies, voice messages, reactions, and typing indicators (reuse existing patterns).
- Shared crew XP pool: any member earns XP → a small percentage also feeds crew total.
- Crew badge appears on member profiles and hover cards.
- Owner/Admin can grant exclusive crew cosmetics (badge/frame) from a hidden Staff vault.

### UI
- New `/crews` route: list my crews + discover public crews.
- `/crews/$slug` route: crew hub with chat, members, shared XP bar, invite panel.
- Add "Crews" to AppShell nav under People.

---

## 2. Season Pass

### Database
- `public.seasons`: id, name, starts_at, ends_at, active, created_at.
- `public.season_tiers`: season_id, tier, reward_type (sparks/cosmetic/title/xp), reward_value, cosmetic_slug, created_at.
- `public.season_progress`: user_id, season_id, xp, claimed_tiers (integer[]), created_at, updated_at.

### Logic
- Automatically activate the current season (one active at a time, seeded for this month).
- Season XP sources: every XP event also adds to season progress at a 1:1 rate capped by source (same sources as normal XP).
- Claiming a tier: server function checks XP threshold, marks tier claimed, awards reward.
- Monthly reset: a scheduled edge-like server route starts a new season and archives the old one. For now, Owner can manually rotate via Admin panel.

### Rewards (50 tiers)
- Tiers 1–10: Sparks, small XP bursts, common cosmetic.
- Tiers 11–25: Rare cosmetics, titles, larger Sparks.
- Tiers 26–40: Epic badges/frames, profile effects.
- Tiers 41–50: Mythic cosmetic at 50, exclusive "Season Legend" title.

### UI
- New `/season` route: vertical tier track, current tier highlighted, claim buttons, season timer.
- Teaser on Home page: "Season 1 ends in X days" with progress.

---

## 3. Widget Profiles

### Database
- `public.profile_widgets`: user_id, widget_type, position_x, position_y, width, height, config (jsonb), created_at, updated_at.
- `public.profiles.showcase` already exists; we extend it to hold widget order if needed, or keep widgets in their own table.

### Widgets available
- Rank badge + level
- Total XP / stats
- Spotify picks
- Achievements grid
- Showcase (equipped cosmetics)
- Friends streaks
- Pulse Rush best runs
- Custom bio card

### Features
- Edit mode on `/profile`: drag to move, resize, hide, add, remove widgets.
- Public profile (`/u/$username`) renders the same widget layout read-only.
- Default layout for users who haven't customized.

### UI
- Toggle "Edit layout" on profile page.
- Simple grid-based editor (not free-form drag for stability): 2-column grid, each widget spans 1 or 2 columns.

---

## Out of scope for this update
- Crew level editor for Pulse Rush (declined).
- Paid/premium season pass tiers.
- Real-time crew voice/video calls (text + async voice messages only).

---

## Order of work
1. Database migrations for crews, season, widgets.
2. Build Crews backend + UI.
3. Build Season Pass backend + UI.
4. Build Widget Profiles backend + UI.
5. Navigation updates, admin grants, and final polish.
6. Typecheck + Playwright verification.
