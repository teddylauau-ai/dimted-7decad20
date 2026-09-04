# Cursor glow refinement

## Goal
Tone down the cursor-following glow so it feels like a soft background highlight instead of a large coloured spotlight.

## Changes
1. Reduce the core spotlight radius from 520px to 280px and the aura from 720px to 420px.
2. Lower the primary colour opacity in the core from 22% to 8% and the foreground mix from 10% to 4%.
3. Lower the aura primary opacity from 8% to 3%.
4. Add a 40px blur to the core gradient so the edge fades into the background instead of forming a hard circle.
5. Change the core mix-blend-mode from `screen` to `normal` so it does not punch through dark surfaces.
6. Reduce the aura layer opacity from 70% to 40%.
7. Keep the existing pointer tracking, reduced-motion/touch gating, and z-index.

## Files to edit
- `src/styles.css` — adjust `cursor-glow` and `cursor-glow-aura` utilities.
- `src/components/dimted/CursorGlow.tsx` — reduce the aura layer opacity.

## Verification
- Run TypeScript check.
- Confirm the glow is visible but subtle on the home page and does not dominate the UI.
