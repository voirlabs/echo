# Security policy

## Reporting a vulnerability

Please don't open a public issue for security problems.

Report it privately through GitHub: on this repository, open **Security** and choose
**Report a vulnerability**
([docs](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

If you can't use GitHub, email contact@voirlabs.io instead.

Include steps to reproduce and the impact you expect. We aim to acknowledge reports within
three business days and will keep you updated until it's resolved.

## Scope

In scope: reading or changing the owner's data without signing in, bypassing sign-in or the
CSRF or CORS checks, the OAuth server (codes, PKCE, tokens, redirect URIs), the MCP
endpoint's token and scope checks, the extension sending page content anywhere other than
the user's own server, and rate limits bypassed with a spoofed `X-Forwarded-For` when
`TRUSTED_PROXY_HOPS` is set correctly.

Prompt injection from a third-party page the extension scanned is in scope when it gets
the assistant to change the owner's profile, entries, samples or style, or to send the
owner's data anywhere.

Out of scope: prompt injection that only changes the wording of a draft the user's own
model writes for that user (they review it before sending), and rate limiting across
several app instances (the limiter is in memory, a documented limitation).

## Supported versions

Only the latest release on `main` receives security fixes.
