# Configuration and deployment

All configuration is environment variables, listed in `apps/web/.env.example` and the
README. Deployment values (URLs, operator, legal links) are read in
`apps/web/src/lib/site.ts`; when an optional value is unset, whatever would use it is
hidden.

## Running in production

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate                       # prisma migrate deploy
pnpm --filter ./apps/web build
pnpm --filter ./apps/web start        # next start on port 3000
```

Run it under any process manager (systemd, Docker, a PaaS). It is one Node process; the
rate limiter lives in that process, so run a single instance or put a shared limiter in
front.

Set at least `DATABASE_URL`, `ADMIN_PASSWORD` (12+ characters; `openssl rand -base64 18`
makes one), `SESSION_SECRET` (32+ characters) and `NEXT_PUBLIC_APP_URL`. `NEXT_PUBLIC_*`
values are built into the client bundle, so rebuild after changing them. Echo has one
owner: whoever knows `ADMIN_PASSWORD`. Without it (or with one too short, or without a
long enough `SESSION_SECRET`) the sign-in page says what to set, and nobody can sign in.
Signing out signs out every device; so does changing either value and restarting. The
session cookie is `Secure` when `NEXT_PUBLIC_APP_URL` is https.

Wrong passwords back off: after five from one address (or twenty in all), each further
one doubles the wait, up to 15 minutes. A browser that has signed in before keeps its own
count, so guesses from elsewhere can't lock the owner out of it.

## Reverse proxy

Put a TLS-terminating proxy in front and keep port 3000 closed to the internet. The
proxy must pass the original `Host` header (the CSRF check compares `Origin` with it) and
append to `X-Forwarded-For`. `TRUSTED_PROXY_HOPS` is the number of proxies that append to
it: set `1` for nginx alone, `2` for a CDN in front of nginx when both append. It defaults
to `0`, for nothing in front: then every client shares one rate-limit bucket, which is
safe but coarse. Never set it higher than the proxies you run, or clients can pick their
own address.

```nginx
server {
    listen 443 ssl http2;
    server_name echo.example.com;
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
    }
}
```

Don't cache `/api/*` or `/mcp`. Claude and ChatGPT need the app on public HTTPS to reach
`/mcp`.

## The extension build

One build works with any server. On first run the popup asks for the server's address
and requests access to that one origin (`optional_host_permissions`); the settings button
in the popup's header switches to another server later. A build made with `APP_URL` starts
with that server filled in and already granted, which is useful for development and for a
build you install yourself.

| Variable | Default | Meaning |
|---|---|---|
| `APP_URL` | none (the user enters it) | A server to start with, granted at install |
| `SITE_URL` | `APP_URL`, else the Echo site | The store listing's homepage link |
| `PRIVACY_URL` | `docs/extension-privacy.md` on GitHub | The privacy link in the popup |

```bash
pnpm --filter ./apps/extension pack                                    # store build: echo-extension.zip
APP_URL=https://echo.example.com pnpm --filter ./apps/extension pack   # starts with your server
```

## Limiting which extension may call the server

By default any Chrome extension the user installs and grants access to the server may
call `/api/extension/*` (a website can't, since it can't send a `chrome-extension://`
Origin). To allow only your build, set `EXTENSION_IDS` to its id (shown in
`chrome://extensions`; several ids comma-separated). Other extensions are then refused on
those routes, and the allowed ones may only `POST` with their Origin.

## Health

`GET /api/health` returns 200 when the database answers, else 503.
