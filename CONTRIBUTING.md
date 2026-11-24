# Contributing to Echo

Thanks for helping out.

## Getting set up

You need Node.js 24, pnpm 10 and Docker (or any Postgres 16).

```bash
pnpm install
docker compose up -d
cp apps/web/.env.example apps/web/.env   # set ADMIN_PASSWORD and SESSION_SECRET
pnpm db:setup
pnpm dev
```

No AI key is needed to work on the app: the server never calls a model. To try the
writing paths, connect an assistant over MCP (see [docs/mcp.md](docs/mcp.md)) and use the
extension on a page (see [docs/extension.md](docs/extension.md)).

## Before you open a PR

```bash
pnpm check   # lint, typecheck and tests
pnpm build   # the web app and the extension; must pass with no keys set
```

The integration tests need a disposable, migrated Postgres:

```bash
docker compose exec postgres createdb -U echo echo_test
DATABASE_URL=postgresql://echo:echo@127.0.0.1:5432/echo_test pnpm db:migrate
TEST_DATABASE_URL=postgresql://echo:echo@127.0.0.1:5432/echo_test pnpm test
```

CI runs the same commands, with Postgres. Keep PRs focused on one change and describe
what you tested.

## Code guidelines

- TypeScript strict mode, no `any`.
- Validate every request body with Zod (`parseJson` in `apps/web/src/lib/api.ts`).
- Schema changes go in `apps/web/prisma/schema.prisma` with a migration:
  `pnpm db:migrate:dev --name <what>`.
- Deployment values come from env through `apps/web/src/lib/site.ts`. Never hardcode a
  hosted domain.
- Add or update tests in `tests/` for logic you change.
- UI follows the Voir Labs dark theme: the tokens and the `btn`, `input`, `card`, `label`
  and `display` classes in `apps/web/src/styles/globals.css`. The extension's
  `popup.css` mirrors them.

## Commit messages

Short imperative subject line, for example `Add a kind to check_draft` or
`Fix insert into contenteditable editors`.

## Code of conduct

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
