<p align="center">
  <img src="apps/web/public/logo.svg" alt="" width="72" height="72">
</p>

<h1 align="center">Echo</h1>

<p align="center">
  Emails, messages, posts and applications in your own voice, written by the AI you already use.
</p>

<p align="center">
  <a href="https://github.com/voirlabs/echo/actions/workflows/ci.yml"><img src="https://github.com/voirlabs/echo/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-d0a2ff.svg" alt="License: MIT"></a>
</p>

![Saved drafts in Echo](docs/screenshot-drafts.png)

## What it does

- It keeps a knowledge base about you without any forms. As you chat, your assistant saves who you are, facts it can cite (roles, projects, results) and samples of your writing. You see it all on one page and can remove anything that's wrong.
- It works inside Claude or ChatGPT. An MCP connector gives your assistant the parts of your profile that matter for what you're replying to. The assistant works out what you need (an email, a reply, a post, an application), checks its draft against your style and saves it.
- It learns from your edits. When you rework a saved draft, Echo offers to add your version as a writing sample, so your style is learned from text you wrote yourself.
- It checks drafts against how you write. Your style is measured from your samples (rhythm, punctuation, openings, length, AI tells), and your assistant builds a style guide from them.
- It drafts the page you're on. Open the extension on a page and copy its one-line prompt into Claude or ChatGPT. The assistant drafts every field, and back on the page one click fills them all in. It never sends or submits anything.

## How it works

```
 Claude / ChatGPT ──MCP + OAuth 2.1──▶ apps/web (/mcp)       Next.js: profile, samples, drafts,
                                          │                    MCP and OAuth server, extension API
 Chrome extension ──session cookie──▶     │ /api/extension (page requests, drafts)
                                          ▼
                                       Postgres
```

The server never calls a model. It picks what is relevant from your knowledge base, gives
your model the rules for your voice, checks the draft and stores it. The model does the
writing, on your own plan or key. See [docs/architecture.md](docs/architecture.md).

## Quickstart

You need Node 24, pnpm 10 and Docker (or any Postgres 16).

```bash
git clone https://github.com/voirlabs/echo.git && cd echo
pnpm install
docker compose up -d                                  # Postgres on 127.0.0.1:5432
cp apps/web/.env.example apps/web/.env                # then set ADMIN_PASSWORD and SESSION_SECRET
pnpm db:setup                                         # generate the client and migrate
pnpm dev                                              # http://localhost:3000
```

Echo has one owner. Sign in with `ADMIN_PASSWORD`, then connect your assistant, which fills
in your profile and writing samples as you chat. `SESSION_SECRET` is any random string of 32
or more characters (`openssl rand -base64 32`).

**Connect an assistant.** Claude and ChatGPT reach `/mcp` over public HTTPS, so for local
testing put a tunnel in front of port 3000 (`cloudflared tunnel --url http://localhost:3000`)
and set `NEXT_PUBLIC_APP_URL` to its URL. The **Connect** page has the steps. See
[docs/mcp.md](docs/mcp.md).

**Build the extension.**

```bash
pnpm --filter ./apps/extension build
```

Load `apps/extension/dist` as an unpacked extension in `chrome://extensions`. On first run it
asks for your server's address (`localhost:3000` here) and access to it. See
[docs/extension.md](docs/extension.md).

## Configuration

Set in `apps/web/.env` (copied from [`apps/web/.env.example`](apps/web/.env.example)).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `ADMIN_PASSWORD` | Yes | The password the owner signs in with; at least 12 characters (`openssl rand -base64 18`) |
| `SESSION_SECRET` | Yes | Signs the session cookie; at least 32 characters. Changing it, or `ADMIN_PASSWORD`, signs out every device, as signing out does |
| `NEXT_PUBLIC_APP_URL` | Yes | The app's public URL: OAuth issuer, MCP server URL. Default `http://localhost:3000` |
| `OAUTH_ISSUER` | No | OAuth issuer, only when served from another origin than `NEXT_PUBLIC_APP_URL` |
| `TRUSTED_PROXY_HOPS` | No | Reverse proxies that append to `X-Forwarded-For` (rate limiting). Default `0`; set `1` behind one reverse proxy |
| `EXTENSION_IDS` | No | Comma-separated Chrome extension ids allowed to call `/api/extension/*`. Unset: any extension the user granted access to the server |
| `NEXT_PUBLIC_OPERATOR_NAME` | No | Who runs this instance, shown in the footer |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | No | Contact address shown in the footer and error pages |
| `NEXT_PUBLIC_TERMS_URL` | No | This instance's terms of service |
| `NEXT_PUBLIC_PRIVACY_URL` | No | This instance's privacy policy |
| `NEXT_PUBLIC_EXTENSION_URL` | No | The extension's store listing |

The extension's build variables (`APP_URL`, `SITE_URL`, `PRIVACY_URL`) are in
[docs/configuration.md](docs/configuration.md#the-extension-build).

## Deploy

It's one Next.js app and Postgres: `pnpm db:migrate`, `pnpm --filter ./apps/web build`, then
`pnpm --filter ./apps/web start` behind a TLS-terminating reverse proxy that passes the
`Host` header. Set `TRUSTED_PROXY_HOPS` to match. Details, an nginx example and the
extension build for your server are in [docs/configuration.md](docs/configuration.md).

The landing page in [`site/`](site) is a separate static site on Firebase Hosting. See [site/README.md](site/README.md).

## Development

```bash
pnpm check    # lint, typecheck and tests
pnpm build    # the web app and the extension
```

The OAuth, MCP and style-learning integration tests run against a disposable, migrated
database and are skipped without one:

```bash
docker compose exec postgres createdb -U echo echo_test
DATABASE_URL=postgresql://echo:echo@127.0.0.1:5432/echo_test pnpm db:migrate
TEST_DATABASE_URL=postgresql://echo:echo@127.0.0.1:5432/echo_test pnpm test
```

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Voir Labs LLC. Echo is by [Voir Labs](https://www.voirlabs.io/).

The Echo and Voir Labs logos and the artwork in `site/assets/` are not covered by the license.
