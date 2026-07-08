# Next

## Recommended Next Action

For the next nontrivial project change, start by reading `AGENTS.md` and the continuity files listed there. Work inside the requested app scope, then update any changed continuity facts and run `npm run continuity:check` before finishing.

## Current Work Mode

Normal app maintenance with continuity tracking. The self-improvement queue is active but empty.

## Boundaries

- Keep continuity updates factual and scoped to changed project knowledge.
- Do not add app AI functionality unless the user explicitly asks for it.
- Do not change secrets, credentials, Supabase configuration, production behavior, project goals, or destructive/archive rules without explicit user input.
- Keep the full reusable Project Continuity spec out of this repo unless the user asks for a broader install.
- Preserve the root `AGENTS.md` follow-through loop: relevant validation, commit, push, Vercel deployment status, and live page verification.

## Continue Prompt

Use this prompt to resume:

```text
Continue the Steam Backlog Tracker project. Read AGENTS.md first, then docs/project-continuity/project/project-continuity.yaml, PURPOSE.md, STATUS.md, NEXT.md, USER_INPUT.md, HANDOFF.md, DECISIONS/README.md and relevant decisions, docs/project-continuity/spec/SELF_IMPROVEMENT.md, and PROPOSED_CHANGES.md. Make the requested change, keep continuity updates factual, run relevant validation plus npm run continuity:check, then commit, push, and verify the Vercel deployment unless explicitly told not to.
```
