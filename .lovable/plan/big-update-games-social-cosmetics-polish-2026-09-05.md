# Big Update: Games, Social, Cosmetics, Polish

## Games & Pulse Rush
- Pulse Rush: add levels 22–27 (Demon tier) with new mechanics (mini portals, double-speed sections); solver-verify all are beatable.
- New endless mode "Infinite Run": procedurally generated segments, best-distance leaderboard, coin rewards.
- Daily challenge gets its own leaderboard tab + streak tracker.

## Social & chat
- Image sharing in DMs and community channels (upload from files/photo library, renders inline, tap to zoom).
- Pinned messages: one pinned message per DM/channel, visible as a banner at top of chat.
- Message editing for your own messages (with "edited" marker).

## Cosmetics & progression
- ~12 new public cosmetics (nametags, frames, banners, effects) with fresh rarities.
- New armory milestones at 50/75 owned items.
- "Showcase" slots on profiles: pin up to 3 favorite cosmetics to display above the rest.

## Look & feel
- Global polish pass: tighter spacing consistency, smoother hover/press micro-interactions (reduced-motion safe), refined card glows and borders across Home, Shop, Armory, Profiles.
- Subtle page-level ambient animation on Home (aurora drift) matching existing midnight-navy glass direction.

## Technical notes
- New tables: pinned_messages, message image attachments (new columns on messages/community_messages), profile showcase (columns on profiles); all with GRANTs + RLS per project rules.
- Image uploads via new private storage bucket with RLS, same pattern as voice bucket.
- All Pulse Rush levels solver-verified beatable before shipping.
- No changes to role hierarchy, vaults, level curve, or monetization.
