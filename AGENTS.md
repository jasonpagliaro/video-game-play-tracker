<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Publish and Deployment Follow-Through

When implementation work is complete in this repository, automatically finish the loop unless the user explicitly says not to:
- Run the relevant local validation (`npm test`, `npm run lint`, and `npm run build` for app changes).
- Commit the scoped changes and push them to the GitHub remote.
- Verify the Vercel deployment created from the push, including the deployment status and at least one live page load.
