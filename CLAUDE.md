# Working rules for AI agents

Echo keeps a knowledge base about the user ("About you", profile entries it can cite,
writing samples), which their assistant fills in over MCP instead of the user typing it.
It measures their writing style and gives all of that to the AI that writes for them:
their own Claude or ChatGPT, over MCP. The browser extension reads the page the user wants filled,
hands it to their assistant as a request, and fills in what it drafted. Keep it small: no features outside that flow.

## Workflow
- Work on a branch and open a pull request. Never push to `main` directly.
- Run `pnpm check` (lint, typecheck, tests) before every commit. `pnpm build` must pass
  with no keys set.
- Add or update tests in `tests/` for logic you change.
- Schema changes go in `apps/web/prisma/schema.prisma` with a migration
  (`pnpm db:migrate:dev --name <what>`).

## Invariants
- One owner per instance: the `users` row with id `owner` (`OWNER_ID` in
  `apps/web/src/lib/auth.ts`), signed in with `ADMIN_PASSWORD`. Don't add sign-up,
  multi-user or email code paths. Keep the password check constant-time
  (`passwordMatches` in `apps/web/src/lib/session-token.ts`).
- The server never calls a model and stores no AI key. The extension never calls a model
  either.
- The extension acts only on the user's click: it never submits a form and never reads a
  page in the background.
- Cookie-authed mutations pass the Origin check in `apps/web/src/proxy.ts`; request bodies
  are validated with Zod.
- The product name, repo URL and app URL come from `apps/web/src/lib/site.ts`; the
  extension gets the name stamped in by `apps/extension/scripts/build.mjs`. Every env var
  is in `apps/web/.env.example` and the README table.
- Errors must be visible to the user. No silent failures.
