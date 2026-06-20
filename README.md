# Steam Backlog Tracker

A personal Steam backlog execution tool built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth, Supabase Postgres, and Drizzle.

Phase 1 includes CSV import, backlog views, status transitions, active rotation limits, replacement workflow, queue ranking, category-aware queue insertion, settings, and core tests. Steam API sync, check-ins, milestones, drag-and-drop queue, and scheduled sync are intentionally deferred to later phases.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and fill:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `APP_ALLOWED_EMAILS`
3. Apply the initial SQL migration in `src/db/migrations/0000_initial.sql` through Supabase SQL editor or `npm run db:migrate`.
4. Run the app:

```bash
npm install
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

## Phase 1 Routes

- `/` dashboard
- `/rotation`
- `/backlog`
- `/queue`
- `/completed`
- `/dnf`
- `/parking-lot`
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

Imports upsert by Steam app id when present, otherwise normalized title. Manual status, notes, DNF decisions, queue position, and manually edited slot/type decisions are preserved on update.

## Deployment

Deploy on Vercel with the same env vars from `.env.example`. Configure Supabase Auth redirect URLs for the production domain and preview URLs. Run migrations before promoting a production deployment.

