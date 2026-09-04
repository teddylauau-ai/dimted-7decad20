# Rebrand: Dimted becomes Lumo

A shorter, softer name that rolls off the tongue — "loo-mo". The tribute stays noticeable: **Lu** from **Lau**, and the mark reads as an "L" pip rising through a level bar.

## What changes

**Name and voice**
- Every user-facing "Dimted" becomes "Lumo" — sign-in screen, nav, page titles, empty states, toasts, quest and level copy, admin panel labels.
- Tagline stays the same idea, tuned to the new name: "Lumo — the more you talk, the further you get."
- Wordmark becomes lowercase `lumo.` with the gold pip kept.

**Logo and icons**
- New brand mark: an "L" stroke with the detached pip above it (same minimal, level-ladder idea as today's "D", so it still reads at 20px in the rail).
- Regenerate favicon, 32/192/512 icons, apple touch icon and the web manifest name/short_name so the browser tab and phone home-screen show Lumo.

**Metadata / SEO**
- Root titles, description, OG tags, `og:site_name`, `application-name`, apple web app title and JSON-LD all switch to Lumo.
- Canonical and OG URL keep pointing at `https://dimted.com/` since the domain stays for now, so school access is not disrupted.

**Domain**
- No domain work. `dimted.com` and the Netlify site keep working exactly as they do today. The app simply calls itself Lumo. A matching `.com` can be added later without redoing any of this.

## What does not change

- No database rename. Table names, RPC names and columns stay as they are — renaming them would risk breaking the live site and the Netlify build for zero user-visible gain.
- No route changes; `/pulse`, `/armory`, `/shop` etc. stay put.
- Progression, cosmetics, roles and the Owner vault are untouched.

## Technical notes

- Internal code identifiers (`useDimted`, `DimtedProvider`, `src/lib/dimted*.ts`, `src/components/dimted/`) stay named as-is to keep the diff safe and reviewable; only user-visible strings change. A follow-up pass can rename the files if wanted.
- Files touched: `src/components/dimted/Brand.tsx` (mark + wordmark), `src/routes/__root.tsx` (head/meta/JSON-LD/favicon links), `src/components/dimted/AuthScreen.tsx` and `AppShell.tsx` (copy + aria labels), plus the handful of routes that print the name in body copy.
- New icon assets generated from the new mark and written to `public/`, replacing the current icon set; `site.webmanifest` updated.
