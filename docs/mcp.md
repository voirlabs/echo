# The MCP server

`/mcp` is a remote MCP server (stateless Streamable HTTP, JSON responses) with its own
OAuth 2.1 authorization server. A user connects Claude, ChatGPT or another MCP client to
their account; the assistant writes in their voice on their own plan and saves the draft.

## Connecting

The server URL is `<NEXT_PUBLIC_APP_URL>/mcp`, on public HTTPS. For local testing put a
tunnel in front of port 3000 (for example `cloudflared tunnel --url http://localhost:3000`)
and set `NEXT_PUBLIC_APP_URL` to the tunnel's URL. The **Connect** page in the app has the
steps:

- Claude: Settings, Connectors, Add custom connector, with the server URL.
- ChatGPT: Settings, Apps, turn on developer mode, then create an app with the same
  URL and OAuth.

## Tools

| Tool | Does |
|---|---|
| `get_writer_context` | Profile summary, the profile entries most relevant to the brief, two voice examples, the writing rules, and `style_tasks_waiting` |
| `check_draft` | `checkStyle` with the user's measured metrics and the `kind` of text (email, message, post, application, other; the assistant picks it); returns issues and a cleaned text |
| `save_draft` | Checks, then saves a new draft (with its link, if any). Pass `draft_key` to update a draft. Returns `draft_key` and `draft_url` |
| `get_style_tasks` | Up to three tasks: notes on samples without notes, then the style guide |
| `save_style_result` | Applies one task's answer; an unknown task or empty answer returns an error to retry |
| `add_writing_sample` | Adds text the user wrote as a writing sample |
| `get_page_request` | A page the user scanned with the extension, under `untrusted_page` with a `notice`: its text (between `<untrusted_page_content>` markers), its fields (with `field_id`, label, kind, length limit), then the writing context. Marks the request as being drafted |
| `save_page_draft` | Saves a value for each field of a page request (long answers are style-checked first) and marks it ready for the extension to fill |
| `get_profile` | Everything saved: name, about, entries with their `entry_id`, writing samples, whether the style guide is built |
| `update_about_me` | Sets the user's name and a short summary of who they are |
| `save_profile_entry` | Saves a fact the assistant can cite (a role, a project, a result); the same title updates the existing entry. Pass `entry_id` to update a specific one |
| `remove_profile_entry` | Removes an entry by `entry_id` |

The assistant keeps the profile: the server instructions tell it to save facts the user
mentions, their name and summary, and text they share as samples, and to say in one line
what it saved. The web app shows the profile and lets the user remove anything.

A page request is a third-party website's content, which anyone can write. It comes back
marked as untrusted data, and the server instructions and tool descriptions tell the
assistant never to follow instructions in it and never to change the profile because of
it. The tools that change the profile or samples (`update_about_me`, `save_profile_entry`,
`remove_profile_entry`, `add_writing_sample`, `save_style_result`) are annotated
`destructiveHint: true` and are for the user's own words in the conversation only, so
clients that ask before such calls will ask.

## OAuth endpoints

| Path | Purpose |
|---|---|
| `GET /.well-known/oauth-protected-resource` (and `/mcp` suffix) | RFC 9728 resource metadata |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 server metadata |
| `POST /api/oauth/register` | Dynamic client registration (RFC 7591), public clients only |
| `GET /oauth/authorize` | Consent screen, after sign-in; shows where the user will return to |
| `POST /api/oauth/authorize` | Consent form target; issues a one-time code |
| `POST /api/oauth/token` | `authorization_code` (PKCE S256, and the same `redirect_uri` as the authorization request; a client with one registered URI may leave it out of both) and `refresh_token` (rotating) |
| `POST /api/oauth/revoke` | RFC 7009 revocation |

Codes live 5 minutes, access tokens 1 hour, refresh tokens 60 days. A missing or bad
token on `/mcp` gets `401` with `WWW-Authenticate: Bearer resource_metadata=…`; a token
without the `proposals` scope gets `403`. You can see and disconnect assistants under
Profile, Connected assistants.

Set `OAUTH_ISSUER` only when the app is served from another origin than
`NEXT_PUBLIC_APP_URL`.
