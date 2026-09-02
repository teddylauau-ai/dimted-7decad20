# Deploying Dimted to Netlify

## Steps

1. Create a free account at https://app.netlify.com
2. Put this folder on GitHub:
   - `git init && git add -A && git commit -m "dimted"`
   - Create a private repo on github.com and push it.
3. In Netlify: **Add new site → Import an existing project → GitHub** and pick the repo.
4. Build settings: leave these alone — `netlify.toml` in this repo already sets
   the build command (`npm run build`) and the publish directory (`dist`), and it
   overrides anything set in the Netlify UI.

   If you ever set them by hand, the publish directory is `dist`. It is **not**
   `.output/public`: this app builds with nitro, which detects Netlify and writes
   the static files to `dist/` and the server handler to
   `.netlify/functions-internal/server/`.
5. In **Site settings → Environment variables**, copy every variable from the `.env` file in this folder (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID).
6. Deploy.

## Important — what will and won't work off Lovable

- **Accounts, chat, profiles, XP, games, shop, admin**: these talk directly to the cloud database from the browser, so they keep working as long as the env vars above are set. Nothing is purchasable/lost.
- **Server-side actions (study Tutor AI, admin grants, etc.)**: these run through Lovable's platform and may NOT work on a self-hosted copy — the AI key is only available inside Lovable. The rest of the app is unaffected.
- **Keep `.env` private**: use a PRIVATE GitHub repo, and never post the keys publicly.
- Changes you make in Lovable do NOT automatically appear on the Netlify copy — you'd have to re-download and re-deploy. Your live dimted.com site stays the main one.

## Easier alternative

Lovable has a built-in GitHub sync (Project Settings → GitHub → Connect). That keeps a copy of the code on GitHub automatically, and you can import that repo into Netlify the same way.
