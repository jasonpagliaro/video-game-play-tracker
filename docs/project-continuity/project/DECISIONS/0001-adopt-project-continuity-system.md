# 0001: Adopt Project Continuity System

Date: 2026-07-07
Status: Accepted

## Context

The repository already had root `AGENTS.md` instructions for Next.js, local validation, dependency recovery, commit/push follow-through, and Vercel deployment verification. It did not have durable project-continuity files or a structured self-improvement queue.

The user asked to add the Project Continuity System to this project for self-improvement.

## Decision

Adopt Project Continuity System `0.1.0` using the MVP file set, merged into the existing `AGENTS.md`, plus the opt-in self-improvement policy, `PROPOSED_CHANGES.md` queue, first decision record, and local validator.

The install depth is `mvp_plus_self_improvement`.

Do not copy the full reusable Project Continuity spec into this repo. Keep the existing `AGENTS.md` repository instructions authoritative.

## Consequences

- Future nontrivial work should start from `AGENTS.md` and the continuity files listed there.
- Meaningful sessions should end by updating changed continuity facts and running `npm run continuity:check`.
- Improvement ideas must be evidence-backed, ranked, actionable, and recorded in `PROPOSED_CHANGES.md`.
- This decision changes documentation and workflow guidance only. It does not change app behavior, dependencies, database schema, deployment configuration, Supabase configuration, Steam sync behavior, or Vercel Cron behavior.
