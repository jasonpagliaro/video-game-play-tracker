# Status

Version: `0.1.0`

## Current State

Project Continuity System MVP files plus the self-improvement policy and proposal queue were installed on `2026-07-07`.

The continuity install is documentation and validation only. It does not change app behavior, dependencies, database schema, deployment configuration, Supabase configuration, Steam sync behavior, or Vercel Cron behavior.

## Known Facts

- The app is a Next.js `16.2.9` App Router project with React `19.2.4`, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Drizzle, and Vitest.
- The project is deployed on Vercel. The reliable live production alias is `https://video-game-play-tracker.vercel.app`.
- Local setup uses Node.js 20 and npm 10 with `npm ci` as the preferred recovery path when dependencies are missing or corrupt.
- The normal app validation commands are `npm test`, `npm run lint`, and `npm run build`.
- Continuity validation is `npm run continuity:check`.
- Root `AGENTS.md` remains authoritative for Next.js docs, dependency recovery, validation, commit, push, and Vercel verification follow-through.
- The app currently avoids direct AI functionality; AI recommendations are deferred until explicitly requested.

## Recently Completed

- Updated active dashboard Steam handoff actions so the Install and Launch buttons reflect the tracker's installed state.
- Changed the dashboard Library metric to show active queue count over total library count and added a compact progress meter toward an empty queue.
- Installed the Project Continuity System MVP file set.
- Added the controlled self-improvement policy and `PROPOSED_CHANGES.md` queue.
- Added a local continuity validator and package script.
- Captured the adoption decision in `DECISIONS/0001-adopt-project-continuity-system.md`.

## Active Improvement Queue

No active proposed improvements are recorded yet.
