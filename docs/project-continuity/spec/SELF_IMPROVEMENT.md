# Self-Improvement

The Project Continuity System improves through controlled proposals.

## Improvement Sources

Improvements may come from:

- repeated confusion during project work
- stale or duplicated documentation
- failed handoffs
- missing validation steps
- recurring AI mistakes
- user feedback
- internal audits
- project-type-specific needs
- migration experience from older projects

## Improvement Lifecycle

Every improvement has one of these statuses:

- `Proposed`
- `Needs user input`
- `Accepted`
- `Rejected`
- `Deferred`
- `Implemented`
- `Archived`

## Required Fields

Each proposed improvement must include:

- title
- date
- proposer: human or AI
- problem
- evidence
- proposed change
- affected files
- risk level
- rank: P1, P2, or P3
- input level: auto, review recommended, or user required
- acceptance criteria
- decision

## Session Review Triage

At the end of meaningful work, the system should do a compact improvement review.

Evaluate possible fixes, enhancements, quality-of-life updates, stale or duplicated docs, validation gaps, workflow friction, and recurring mistakes.

Record only actionable ideas in `PROPOSED_CHANGES.md`. An actionable idea has evidence and a practical next step.

Do not record duplicate, vague, or speculative ideas.

Ranks:

- `P1`: correctness, safety, handoff, or validation issue
- `P2`: recurring workflow friction or meaningful enhancement
- `P3`: quality-of-life, clarity, or small documentation improvement

Final responses may mention at most three ranked suggestions when useful.

## Internal Audit Findings

Internal audits check whether the system still provides both a clear specification and a practical implementation method.

Audit scope includes spec clarity, install method, templates, prompts, validation, release/artifact state, stale or duplicate docs, and the health of the self-improvement loop.

Record actionable audit findings in `PROPOSED_CHANGES.md` with evidence, rank, input level, acceptance criteria, and decision status.

## Decision Record Threshold

Accepted self-improvements require a decision record only when they change durable behavior, structure, policy, canonical meaning, migration behavior, versioning, validation expectations, install behavior, user-input gates, or another future-facing rule.

Accepted self-improvements do not need a new decision record when they are minor wording clarifications, typo or link fixes, evidence additions, status or handoff updates, proposal cleanup, or implementation of a change already covered by an existing decision.

Formatting or wording-only preferences never get decision records. Related policy selections should be batched into one decision when they share the same underlying choice.

When no decision record is required, update the proposal `decision` field and any changed status or handoff notes with the reason. Use wording such as `Accepted without decision record; no behavior or canonical meaning change.`

## Proposal Pruning

Keep `PROPOSED_CHANGES.md` focused on active work.

The current work stream is the set of open or recently accepted items that directly supports `NEXT.md`, the active release plan, or active roadmap evidence.

Archive implemented entries after they are older than the current work stream. Use `docs/project-continuity/project/archive/` and include a short note explaining why the entries moved.

Keep these entries active:

- proposed, needs-user-input, rejected, or deferred items
- accepted items that are not implemented
- implemented items still relevant to the current work stream

Archived proposal entries are historical reference. They are not a second active queue and should not be revalidated as open work.

## Rules

- The system may propose improvements to itself.
- The system may not silently make breaking changes to itself.
- The system may not silently change its own user-input policy.
- The system may not silently promote uncertain observations into canonical documentation.
- Every breaking change must include a migration note.
- Every accepted self-improvement that changes future behavior or canonical meaning must include a decision record.
- Formatting or wording-only preferences do not get decision records.
- Related policy selections should be batched instead of split into narrow records.
- Every rejected change must include a short reason.
- Empty optional files should be removed or not created.
- The system should stay as small as possible while preserving continuity.

Input levels are defined in `USER_INPUT.md`. User Required items are hard stops until the user provides explicit input.
