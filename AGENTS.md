<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Publish and Deployment Follow-Through

When implementation work is complete in this repository, automatically finish the loop unless the user explicitly says not to:
- Run the relevant local validation (`npm test`, `npm run lint`, and `npm run build` for app changes).
- Commit the scoped changes and push them to the GitHub remote.
- Verify the Vercel deployment created from the push, including the deployment status and at least one live page load.

## Preferred Environment Recovery Path

Use the existing npm lockfile path before adding tools or dependencies:
- Confirm the local runtime first with `node -v` and `npm -v`; this repo is known to work on Node 20 with npm 10.
- If dependencies are missing or the install looks corrupt, run `npm ci` from the repository root. Do not add direct dependencies to fix an install problem unless a source change actually requires a new package.
- If `npm ci` cannot run because of local permissions, keychain prompts, or network restrictions, stop and ask the user to run that exact command, including the error that blocked Codex.
- After a clean install or dependency-related fix, run `npm test`, `npm run lint`, and `npm run build`.
- `npm ls --depth=0` may report a small set of WASM support packages as extraneous after a clean install. If `npm ci` and the validation commands pass, treat that as package-manager noise rather than a reason to add those packages directly.
- Do not run `npm audit fix --force` as an automatic cleanup step. If audit output requires forced breaking changes, inspect the dependency path and choose an intentional upgrade plan instead.

Repo-specific build gotchas:
- Quote shell paths that include App Router route groups, for example `src/app/(app)/import/page.tsx`.
- `tsconfig.json` targets ES2017, so avoid BigInt literals like `2n`; use `BigInt(2)` or `BigInt("76561198000000000")`.
- For App Router or server action work, read the matching local docs under `node_modules/next/dist/docs/01-app/01-getting-started/` before editing implementation code.
