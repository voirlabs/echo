# Architecture

Echo is a pnpm workspace with two deliverables:

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 app and Postgres (Prisma): the knowledge base, writing samples, saved drafts, the MCP server with its own OAuth 2.1 server, and the API the extension calls |
| `apps/extension` | Chrome extension (Manifest V3): sends the page the user is on to the server as a request for their assistant, then fills in what it drafted |

The server never calls a model. The user's own assistant (Claude or ChatGPT, over MCP)
does the writing. The server supplies the user's material and rules, checks drafts against
the user's measured style, and keeps the drafts.

## Data flow

```
DRAFTING A PAGE (docs/extension.md)
  popup: scans the page → POST /api/extension/requests → Draft (status requested) and a
         one-line prompt with its key, copied for the user
  Claude / ChatGPT: get_page_request (→ drafting) → writes each field →
         save_page_draft (style-checked, → ready)
  popup: GET /api/extension/drafts shows the status → Fill puts each value in its field

WRITING OVER MCP (docs/mcp.md)
  Claude / ChatGPT ── OAuth 2.1 ──▶ /mcp
    get_writer_context → profile, relevant work, two voice examples, writing rules
    check_draft        → checkStyle against the user's measured style
    save_draft         → Draft (random key; update by draft_key)
    get_style_tasks / save_style_result → notes per sample, then the style guide
    add_writing_sample → WritingSample
    get_profile / update_about_me / save_profile_entry / remove_profile_entry
                       → the profile the assistant keeps (users, ProfileEntry)

USING A DRAFT
  popup: Fill rescans the page and puts each value only into its own field (same
         selector and label, still visible); a page without fields is copied instead
         (docs/extension.md)
  web app: /drafts lists, edits (PATCH /api/drafts/[key]), exports and deletes drafts; a
           draft can be added as a writing sample, and an edited one is offered as one;
           /profile shows the profile and samples, which the user can only remove
```

## The main modules (`apps/web/src/lib`)

| File | Role |
|---|---|
| `writer.ts` | `writerContext` and `checkDraft`, used by the MCP tools |
| `writing-style.ts` | Style metrics from the samples, `checkStyle` (kind-aware), voice examples |
| `writing-prompts.ts` | Writing rules, the style-learning prompts, `cleanDraft` |
| `style-tasks.ts` | Style learning without a queue: tasks are read off the samples, for the assistant over MCP |
| `writing-samples.ts` | Add and delete samples; deleting resets the style guide |
| `drafts.ts`, `draft-key.ts` | Saving drafts and their keys |
| `page-requests.ts`, `page-fields.ts` | Page requests from the extension and their fields |
| `profile.ts`, `profile-entries.ts` | The name and "About you", and the profile entries |
| `oauth.ts` | OAuth 2.1 server for `/mcp` |
| `auth.ts`, `session-token.ts` | The one owner (`users.id = 'owner'`), `ADMIN_PASSWORD` sign-in and the signed session cookie |
| `site.ts` | Product name, repo URL and every deployment value from env |

## Style learning

Style has two layers. The measured layer (`computeStyleMetrics`) is deterministic and
recomputed from the samples on every check: sentence rhythm, contractions, punctuation,
openings, lists, length. The learned layer is a prose style guide on `users.writing_style`,
built by the user's assistant over MCP. `get_style_tasks` returns a note task for each
sample without notes, then one guide task that folds the new notes into the guide. The guide task's id records
when it was handed out, so applying it marks exactly the notes it saw. Deleting a sample
clears the guide and marks the rest unlearned, so the next guide task rebuilds it.

## Security

- Sign-in: one owner. `POST /api/auth/login` compares the password (12+ characters) with
  `ADMIN_PASSWORD` in constant time (SHA-256 digests). Failed attempts back off
  (`lib/login-throttle.ts`): per address and across all addresses, except that a browser
  with an `echo_device` cookie from an earlier sign-in keeps its own count. The owner
  row (`id = 'owner'`) is created on first sign-in.
- Sessions: an `echo_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` when
  `NEXT_PUBLIC_APP_URL` is https, 30 days) holding the owner's session epoch and an
  expiry, signed with HMAC-SHA256. The key is derived from `SESSION_SECRET` and
  `ADMIN_PASSWORD`, so changing either ends every session; signing out replaces
  `users.session_epoch`, which does the same.
- CSRF: `lib/origin-check.ts` (run by `src/proxy.ts`) rejects cookie-authed mutations
  (`/api/auth/*`, `/api/user/*`, `/api/drafts/*`, `/api/extension/*`,
  `POST /api/oauth/authorize`) whose `Origin` names another host or can't be parsed. A
  `chrome-extension://` origin may `POST` to `/api/extension/*`, limited to
  `EXTENSION_IDS` when that is set.
- CSP: set per page in `src/proxy.ts` with a nonce (`script-src 'nonce-…' 'strict-dynamic'`),
  so no inline script runs without it. HSTS covers this host only.
- CORS: the extension routes reflect only the app's own origin (the extension holds
  host permission for the server, so it doesn't need CORS). The OAuth and MCP routes are
  bearer-authed and allow any origin without credentials.
- Rate limits: in memory, per client IP and path (`src/proxy.ts`). The IP is read
  from `X-Forwarded-For` from the right, trusting `TRUSTED_PROXY_HOPS` proxies (default
  0: one shared bucket). Client registration is capped at 100 an hour in all, and the
  unauthenticated sign-in and OAuth bodies are read up to 16 KB and validated with Zod.
- Prompt injection: a page request is third-party content; `get_page_request` returns it
  marked untrusted, and the profile-writing tools are `destructiveHint: true` and for the
  user's own words only ([mcp.md](mcp.md)).
- Secrets: OAuth codes and tokens are stored as SHA-256 hashes. A replayed OAuth code
  revokes the tokens it issued, and a replayed refresh token revokes that client's tokens.

## Extension auth

The extension has no token. Its popup fetches the app with `credentials: "include"` and
sends the session cookie. Chrome treats requests from an extension page to a host it has
permission for as same-site, so `SameSite=Lax` cookies go along. It reads the sign-in status and this page's draft, and creates page
requests (`POST /api/extension/requests`).
