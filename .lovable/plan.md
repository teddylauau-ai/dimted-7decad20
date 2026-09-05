# Fix home-page Friends widget layout

## Problem
The small Friends widget on the Home page uses `flex flex-wrap justify-center` with cards sized by `flex-[1_1_140px] max-w-[180px]`. With 4 friends this produces an uneven 3-on-top / 1-on-bottom wrap, cards can feel cramped or overlap, and the absolute-positioned "FL" badge sits near the avatar and can visually collide with neighbouring cards.

## Goal
Make the home Friends widget symmetrical, non-overlapping, and good-looking for any realistic friend count (especially 4).

## Changes
1. **Switch to a responsive grid**
   - In `src/routes/index.tsx`, replace the `<ul className="flex flex-wrap justify-center gap-2.5">` with `<ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">`.
   - Remove `flex-[1_1_140px] max-w-[180px]` from each `<li>`; let grid columns enforce equal widths.
   - Center each card's content and keep the hover/glass styling.

2. **Move the FL badge inline**
   - Remove the absolute `top-2 right-2` FL badge from the friend card.
   - Render it as a small inline chip next to the username/presence line so it never overlaps the avatar or adjacent cards.

3. **Cap visible friends and add "View all"**
   - Show at most 6 friends on the home widget.
   - If there are more than 6, the existing aside link (`{myFriends.length} connected`) already leads to `/friends`; keep it and rely on it as the "view all" path.

4. **Keep existing data and interactions**
   - No changes to `useFriendships`, `friendshipLevel`, `ProfileHoverCard`, `Avatar`, `Nametag`, or routing.
   - Preserve the empty state and the "Find people" action.

## Verification
- Run `bunx tsgo --noEmit` to confirm no TypeScript errors.
- Use Playwright to open the home page and capture a screenshot of the Friends widget with 4 friends, checking for a clean 2x2 grid and no overlaps.
- Check the widget at 2, 3, 5, and 6 friends to confirm balanced rows on desktop and mobile widths.
