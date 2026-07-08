# User Input

Open questions and approval gates live here.

## User Input Policy

### Auto

The system may update factual continuity status, handoff notes, next actions within approved scope, typo fixes, broken internal links, and proposal status cleanup when the change is directly evidenced.

### Review Recommended

The system may propose or apply low-risk documentation clarifications, self-improvement queue additions, and validation checklist refinements, but should flag them for review.

### User Required

The system must request explicit user input before changing project goals, required continuity files, gate policy, accepted durable decisions, versioning, migration rules, destructive/archive behavior, secrets, credentials, production behavior, or project scope.

## Open Questions

None.

## Resolved Choices

- Install depth is MVP plus self-improvement policy, proposal queue, first decision record, and local validator.
- The full reusable Project Continuity spec is not copied into this repo.
- Existing root `AGENTS.md` remains authoritative for Next.js, validation, dependency recovery, commit, push, and Vercel verification instructions.
- Continuity validation is exposed through `npm run continuity:check`.
- Production follow-through remains automatic after implementation work unless the user explicitly says not to; production behavior changes still require explicit user input.

## Provisional Defaults

- Keep the pack small.
- Record decisions only when they affect future work.
- Record proposed improvements only when they are evidence-backed, actionable, and have a practical next step.
