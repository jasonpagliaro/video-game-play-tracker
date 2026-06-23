# Steam Backlog Tracker

A personal Steam backlog execution tool built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth, Supabase Postgres, and Drizzle.

Phase 1 includes Steam library sync, scheduled Steam refresh, CSV import, backlog views, status transitions, active rotation limits, replacement workflow, queue ranking, category-aware queue insertion, settings, and core tests. Store metadata enrichment, achievements sync, check-ins, milestones, drag-and-drop queue, and AI recommendations are intentionally deferred to later phases.

## Setup

Prerequisites:

- Node.js 20
- npm 10
- A Supabase project
- A Steam Web API key for Steam library sync

1. Install dependencies from the lockfile:

```bash
npm ci
```

Use `npm install` only when intentionally changing dependencies. If the local install gets into a bad state, delete `node_modules` and run `npm ci` again rather than adding packages manually.

2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project and fill:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `APP_ALLOWED_EMAILS`
   - `STEAM_API_KEY`
   - `CRON_SECRET`
4. Apply the initial SQL migration in `src/db/migrations/0000_initial.sql` through Supabase SQL editor or `npm run db:migrate`.
5. Run the app:

```bash
npm run dev
```

Without Supabase env vars, local development renders with a placeholder user and empty data so the UI can be inspected.

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
npm run db:generate
npm run db:migrate
```

For environment validation after dependency or toolchain changes, run:

```bash
npm test
npm run lint
npm run build
```

Known local environment notes:

- The app is built against the Next.js version installed in this repo. For App Router implementation changes, prefer the local guides in `node_modules/next/dist/docs/01-app/01-getting-started/`.
- The TypeScript target is ES2017, so use `BigInt(...)` instead of BigInt literal syntax.
- Shell paths under App Router route groups, such as `src/app/(app)/import/page.tsx`, should be quoted.
- npm audit can suggest forced breaking changes for framework transitive dependencies. Do not apply `npm audit fix --force` without an intentional upgrade and validation pass.

## Phase 1 Routes

- `/` dashboard
- `/rotation`
- `/backlog`
- `/queue`
- `/completed`
- `/dnf`
- `/ongoing`
- `/parking-lot` redirects to `/ongoing`
- `/import`
- `/settings`
- `/games/[id]`
- `/login`

## CSV Import

The importer supports flexible column names and maps the discovered Steam export shape:

- `game` -> title
- `id` -> Steam app id
- `hours` -> playtime minutes
- `last_played`
- `release_date` -> release year
- review score columns into Steam review metadata

Imports upsert by Steam app id when present, otherwise normalized title. Manual status, notes, DNF decisions, queue position, and manually edited category/finish-style decisions are preserved on update.

## Steam Library Sync

The Steam sync accepts a SteamID64, `steamcommunity.com/profiles/:id` URL, `steamcommunity.com/id/:vanity` URL, SteamID2, SteamID3, or raw vanity name. It uses `STEAM_API_KEY` server-side to resolve vanity profiles, read the player summary, and pull owned games.

This sync imports library-level data plus best-effort Steam Store metadata: app id, title, total and platform playtime, last played, owner SteamID64, Store genres/categories, release year, review score, and sync timestamps. Store metadata failures do not block library sync, and the app does not use AI.

Steam libraries must be visible to the API. Empty/private-library results are safe: applying one will not mark existing owned games as missing from the latest sync.

## Scheduled Steam Refresh

The app includes a secured Vercel Cron route at `/api/cron/steam-refresh`. It refreshes saved Steam accounts when their per-user Settings cadence is due. The cadence is configured as days plus hours, defaults to 1 day, and is enabled by default after a Steam account has been synced.

Set `CRON_SECRET` in Vercel. The cron route requires `Authorization: Bearer $CRON_SECRET`. The committed `vercel.json` uses a daily trigger so it can deploy on Vercel Hobby. The route still honors days-plus-hours cadences whenever it is invoked; sub-day production refreshes require Vercel Pro cron frequency or an external scheduler calling the same route more often.

## Deployment

Deploy on Vercel with the same env vars from `.env.example`. Configure Supabase Auth redirect URLs for the production domain and preview URLs. Run migrations before promoting a production deployment.
