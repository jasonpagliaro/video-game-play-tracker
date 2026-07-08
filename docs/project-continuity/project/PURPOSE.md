# Purpose

## Project

Steam Backlog Tracker is a personal Steam backlog execution tool built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth, Supabase Postgres, and Drizzle.

This repository uses Project Continuity System `0.1.0` for durable local project memory and a controlled self-improvement loop.

## Intended Users

- The project owner returning to backlog-tracker work after time away.
- AI agents starting without chat history.
- Maintainers handing work between sessions.

## Product Purpose

The app helps execute a Steam backlog rather than only catalog it. It supports Steam library sync, scheduled refresh, CSV import, backlog views, status transitions, active rotation limits, replacement workflow, queue ranking, category-aware queue insertion, settings, and core tests.

AI recommendations are intentionally deferred. Current product behavior should stay deterministic unless the user explicitly asks to add AI functionality.

## Success

A new session can answer:

- What is this project?
- What is true now?
- What should happen next?
- What is blocked on user input?
- What decisions should not be re-litigated?
- Which improvement ideas are evidence-backed and actionable?

## Continuity Success

Continuity succeeds when future work starts from the canonical files in `docs/project-continuity/project/`, preserves the repo-specific `AGENTS.md` deploy and validation loop, and ends with changed continuity facts updated.
