# Get Dimted onto dimted.com

Goal: a school-friendly address with nothing "lovable" or "AI" in it, the same app, and the Dimted logo showing in the browser tab and Google results.

## What happens

1. **Buy dimted.com** — $11.10 for the first year, renews at $11.10/yr. I'll put a purchase card in chat; you fill in details and pay through secure checkout.
2. **Connect it to this project automatically** — the purchase card links the domain straight to Dimted and sets it as the primary address, so `dimted.com` becomes the URL people land on. DNS and the https padlock are handled for you (usually live within minutes, occasionally up to a few hours).
3. **Add `www.dimted.com`** as a second entry that redirects to the main one, so both spellings work.
4. **Re-publish** so the live site serves the newest build on the new domain.

Nothing about the app changes: same accounts, same XP, levels, sparks, arcade, study tutor, shop, communities, control panel and owner powers. The database and logins stay exactly as they are — only the address in the URL bar changes. The old `dimted.lovable.app` link keeps working too.

## Logo and search appearance

Current setup already has a Dimted favicon (`public/favicon.svg` + `favicon.ico`) and a real page title and description, so the tab icon carries over to `dimted.com` unchanged. On top of that I'll:

- Add a PNG app icon and an `apple-touch-icon` so the mark also looks right on phone home screens and in Google's result list (Google ignores SVG-only favicons in some cases).
- Add a `site.webmanifest` with the Dimted name, mark and brand colours so it can be saved to a phone home screen like an app.
- Point the canonical URL at `https://dimted.com` and add JSON-LD site metadata so search results show "Dimted" with the right description rather than a bare URL.
- Give each page (Home, Messages, Communities, Arcade, Study, Discover, Friends, Profile, Shop) its own title and description.

## Honest caveat

If your school filters by category rather than by name, a brand-new domain can occasionally land in an "uncategorised" bucket. `dimted.com` looks like an ordinary website, so it usually passes where `.lovable.app` does not — but I can't guarantee any specific school filter.

## Technical notes

- Purchase and connection go through Lovable's registrar flow; DNS records are written automatically for a Lovable-bought domain.
- Icon work: generate `favicon-32.png`, `favicon-192.png`, `favicon-512.png`, `apple-touch-icon.png` from the existing `BrandMark` glyph; register them plus the manifest in the `head()` of `src/routes/__root.tsx`.
- Per-route `head()` entries added to each content route file for titles, descriptions and og tags.
- No changes to backend, auth, roles or game logic.
