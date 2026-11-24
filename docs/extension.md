# The browser extension

`apps/extension` is a Manifest V3 Chrome extension, bundled with esbuild
(`scripts/build.mjs`, which stamps in the server URL and the product name). Open it with
the toolbar icon or Alt+Shift+O.

## What it does

1. On the page to fill, open the popup. It reads the page: its main text and the
   fields a person would type into (text inputs, text areas, rich editors), with each
   field's label, length limit and a selector to find it again. Only fields a person can
   see count: not hidden, transparent, clipped, `aria-hidden`, moved off the page or
   covered by something else (a field merely scrolled out of view counts). Labels come
   from the text shown next to the field, else its `aria-label` or placeholder. Search
   boxes, passwords, one-time codes and payment fields (by type, `autocomplete` token
   or their wording) are left out.
2. Choose **Copy prompt for your assistant**. The page's text and fields are saved on the user's
   server as a request (a draft with status `requested`), and a short prompt is copied:
   *"Use Echo to draft the page I'm on (request d-...)."*
3. Paste it into Claude or ChatGPT. The assistant calls `get_page_request` with the
   id, writes a value for each field and saves them with `save_page_draft`
   ([mcp.md](mcp.md)). The request shows as *drafting*, then *ready*.
4. Back on the page, open the popup again. It shows the request's status and
   refreshes every few seconds until it's ready. **Fill this page** scans the page again
   and puts each value only into the field it was drafted for: the one with the same
   selector and label, if it's still visible. A value whose field is gone is reported,
   never put anywhere else. Nothing is ever submitted.

**Copy** puts the draft's main text on the clipboard, **Draft this page again** makes a
new request for the page, and **All drafts** opens the list on the server. The settings
button in the header changes the server.

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | Read the page's text and fields and fill a draft, only after the user opens the popup on that tab |
| `storage` | The server address (`local`) |
| Host permission for the user's server | Asked for on first run, for the address the user enters (or granted at install in a build made with `APP_URL`): calls with the user's session cookie |
| Optional `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` | Declared so the user's own server (any address) can be granted at runtime; nothing is requested until they connect |

## Build and load

```bash
pnpm --filter ./apps/extension build                                  # asks for the server on first run
APP_URL=http://localhost:3000 pnpm --filter ./apps/extension build    # starts with your local server
```

Load `apps/extension/dist` as an unpacked extension in `chrome://extensions`. See
[configuration.md](configuration.md#the-extension-build) for the build variables.

The popup uses the Voir Labs dark theme. Nothing is loaded from the network: Urbanist
(400 and 500, SIL Open Font License) ships in `apps/extension/fonts/` and the build copies it
into `dist/`. The popup is an extension page, so no `web_accessible_resources` entry is needed.

Limits: the extension reads and fills the top frame only, so fields inside frames aren't
found; when nothing can be filled (or the page had no fields), the draft goes on the
clipboard instead. Browser pages
(`chrome://`, the Web Store) can't be scripted.

Privacy: [extension-privacy.md](extension-privacy.md).
