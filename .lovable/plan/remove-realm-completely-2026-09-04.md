# Remove Realm completely

Realm no longer exists as a feature, but its leftover `realm_name` field still shows as a "Realm" stat on profile hover cards, which is confusing. Remove every trace.

## Changes

1. **Profile hover card** (`src/components/dimted/ProfileHoverCard.tsx`) — remove the "Realm" stat row so the stats grid no longer mentions it.

2. **Profile data plumbing** — strip `realm_name` from:
   - `src/lib/dimted-queries.ts` (type + SELECT column list)
   - `src/lib/dimted-store.tsx` (profile type)
   - `src/lib/dimted-actions.ts` (profile patch type)
   - `src/lib/roles-queries.ts` (admin profile type + SELECT list)
   - `src/integrations/supabase/types.ts` (regenerate/update types after migration)

3. **Comment cleanup** (`src/lib/games.ts`) — remove the stale "Realm" mention in the header comment.

4. **Database migration** — `ALTER TABLE public.profiles DROP COLUMN realm_name;` (column is no longer used anywhere, so dropping is safe; keeps the schema clean).

## Verification

- `bunx tsgo --noEmit` passes.
- Open a profile hover card and confirm no "Realm" stat appears.
