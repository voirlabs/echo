// Popup. On the page the user wants to fill, it scans the page and offers a short
// prompt to paste into Claude or ChatGPT; copying it saves the page (its text and
// fields) as a request on the user's server. The assistant drafts a value for each
// field over MCP. Back on the page, the popup shows the request's status, and once
// it's ready, Fill puts every value into its field. Nothing is ever submitted.
import { api, ApiError, APP_NAME, type Draft } from "./shared/api";
import { BUILT_IN_URL, getServerUrl, hostOf, originPattern, parseServerUrl, serverReady, setServerUrl } from "./shared/server";
import type { FillField, PageRun, ScannedPage } from "./shared/page";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const POLL_MS = 3000;

let tabId: number | null = null;
let page: ScannedPage | null = null;
let signedIn = false;
let server: string | null = null;
let poll: ReturnType<typeof setTimeout> | null = null;

function setStatus(node: HTMLElement, text: string, isError = false): void {
  node.textContent = text;
  node.className = isError ? "status err" : "status";
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : "Something went wrong.");
const promptFor = (key: string) => `Use ${APP_NAME} to draft the page I'm on (request ${key}).`;

async function copy(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true, () => false);
}

// ── The current page ────────────────────────────────────────────────────────
/** Scan the tab (and, with `fill`, fill it) with page.js, which the popup injects. */
async function onPage(fill: FillField[] | null): Promise<PageRun | null> {
  if (tabId === null) return null;
  const target = { tabId };
  try {
    await chrome.scripting.executeScript({ target, files: ["page.js"] });
    const [res] = await chrome.scripting.executeScript({
      target,
      func: (f: FillField[] | null) => (globalThis as unknown as { echoPage: (f: FillField[] | null) => PageRun }).echoPage(f),
      args: [fill],
    });
    return (res?.result as PageRun | undefined) ?? null;
  } catch {
    return null; // browser pages (chrome://, the Web Store) can't be scripted
  }
}

async function loadPage(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  page = (await onPage(null))?.page ?? null;
}

/**
 * Fill the draft's values into the fields they were drafted for. Only fields
 * that were scanned and are still visible are filled; when none is, the draft
 * goes on the clipboard instead.
 */
async function fill(d: Draft, statusEl: HTMLElement): Promise<void> {
  const result = (await onPage(d.fields))?.fill;
  if (result && result.filled > 0) {
    const missing = result.missing.length ? ` Couldn't find: ${result.missing.join(", ")}.` : "";
    return setStatus(statusEl, `Filled ${result.filled} field${result.filled === 1 ? "" : "s"}. Review the page before you send.${missing}`, result.missing.length > 0);
  }
  const copied = await copy(d.text);
  const why = result ? "The fields it was drafted for aren't visible on the page now." : "This page can't be edited from the extension.";
  setStatus(statusEl, copied ? `${why} The draft is on your clipboard.` : `${why} Open the draft and copy it from there.`, true);
}

// ── Sign-in ──────────────────────────────────────────────────────────────────
async function checkSession(): Promise<void> {
  const dot = $("dot");
  const statusText = $("statusText");
  try {
    const s = await api.session();
    signedIn = Boolean(s.signedIn);
    dot.className = signedIn ? "dot on" : "dot off";
    statusText.textContent = signedIn ? "Signed in" : "Not signed in";
    $("signin").hidden = signedIn;
    $("hint").textContent = signedIn ? "" : `Sign in at ${server ? hostOf(server) : "your server"}, then reopen this popup.`;
  } catch (err) {
    dot.className = "dot off";
    // The server answered with its own reason; otherwise it couldn't be reached.
    const answered = err instanceof ApiError && err.status > 0;
    statusText.textContent = answered ? errorText(err) : `Couldn't reach ${APP_NAME}`;
    $("hint").textContent = answered ? "Try again in a moment, then reopen this popup." : "Check your connection, then reopen this popup.";
  }
}

// ── This page ────────────────────────────────────────────────────────────────
function promptBox(key: string): HTMLElement {
  const box = el("div", "prompt");
  box.append(el("code", "", promptFor(key)));
  return box;
}

function renderCurrent(d: Draft | null): void {
  const card = $("currentCard");
  const status = $("currentStatus");
  const title = el("div", "item-title", d?.title || page?.title || "This page");
  title.title = title.textContent ?? "";
  card.replaceChildren(title);

  if (!page) {
    card.append(el("p", "item-note", "Open the extension on the page you want to fill. Browser pages can't be read."));
    return;
  }
  const fieldCount = page.fields.length;

  if (!d) {
    card.append(
      el("p", "item-note", fieldCount
        ? `${fieldCount} field${fieldCount === 1 ? "" : "s"} to fill. Copy the prompt, paste it into Claude or ChatGPT, then come back and choose Fill.`
        : "No fields found, but your assistant can still draft a reply from the page. Copy the prompt and paste it into Claude or ChatGPT."),
    );
    const ask = el("button", "btn", "Copy prompt for your assistant");
    ask.type = "button";
    ask.addEventListener("click", () => void requestDraft(ask));
    card.append(ask);
    return;
  }

  if (d.status !== "ready") {
    card.append(
      el("p", d.status === "drafting" ? "item-note state live" : "item-note state", d.status === "drafting" ? "Your assistant is drafting it…" : "Waiting for your assistant. Paste the prompt into Claude or ChatGPT."),
      promptBox(d.key),
    );
    const again = el("button", "btn ghost", "Copy prompt again");
    again.type = "button";
    again.addEventListener("click", async () => setStatus(status, (await copy(promptFor(d.key))) ? "Copied. Paste it into your assistant's chat." : "Couldn't copy. Select the prompt and copy it.", false));
    card.append(again);
    schedulePoll();
    return;
  }

  const filled = d.fields.filter((f) => f.value).length;
  card.append(el("p", "item-note state ready", d.fields.length ? `Ready: ${filled} of ${d.fields.length} field${d.fields.length === 1 ? "" : "s"} drafted.` : "Ready"));
  const actions = el("div", "actions");
  // A page without fields has nothing to fill: its draft can only be copied.
  if (d.fields.length) {
    const fillButton = el("button", "btn", "Fill this page");
    fillButton.type = "button";
    fillButton.addEventListener("click", () => void fill(d, status));
    actions.append(fillButton);
  }
  const copyButton = el("button", "btn ghost", "Copy");
  copyButton.type = "button";
  copyButton.addEventListener("click", async () => setStatus(status, (await copy(d.text)) ? "Copied" : "Couldn't copy. Open the draft and copy it from there.", false));
  actions.append(copyButton);
  const redo = el("button", "text-btn", "Draft this page again");
  redo.type = "button";
  redo.addEventListener("click", () => void requestDraft(redo));
  card.append(actions, redo);
}

/** Save the page as a request and copy the prompt that points the assistant at it. */
async function requestDraft(button: HTMLButtonElement): Promise<void> {
  if (!page) return;
  const status = $("currentStatus");
  button.disabled = true;
  try {
    const { key } = await api.request({ url: page.url, title: page.title, pageText: page.text, fields: page.fields });
    const copied = await copy(promptFor(key));
    setStatus(status, copied ? "Prompt copied. Paste it into Claude or ChatGPT; this updates when the draft is ready." : "Copy the prompt below and paste it into Claude or ChatGPT.");
    await refresh();
  } catch (err) {
    setStatus(status, errorText(err), true);
    button.disabled = false;
  }
}

/** Load this page's latest draft or request. */
async function refresh(): Promise<void> {
  if (!signedIn) return;
  try {
    const { draft } = await api.draft(page?.url ?? "");
    $("current").hidden = false;
    renderCurrent(draft);
    $("allDrafts").hidden = false;
  } catch (err) {
    $("current").hidden = false;
    setStatus($("currentStatus"), errorText(err), true);
  }
}

/** While a request is waiting, check again every few seconds until it's ready. */
function schedulePoll(): void {
  if (poll) clearTimeout(poll);
  poll = setTimeout(() => void refresh(), POLL_MS);
}

// ── Server ───────────────────────────────────────────────────────────────────
function showConnect(cancellable: boolean): void {
  $("main").hidden = true;
  $("who").hidden = true;
  $("changeServer").hidden = true;
  $("connect").hidden = false;
  $("cancelConnect").hidden = !cancellable;
  ($("serverUrl") as HTMLInputElement).value = server ?? BUILT_IN_URL;
  $("serverUrl").focus();
}

async function connectServer(): Promise<void> {
  const status = $("connectStatus");
  const parsed = parseServerUrl(($("serverUrl") as HTMLInputElement).value);
  if (!parsed.ok) return setStatus(status, parsed.error, true);
  const pattern = originPattern(parsed.url);
  // Ask for access to this one address, now that the user chose it.
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) return setStatus(status, "The extension needs access to that address to reach your server.", true);
  setStatus(status, "Checking the server…");
  try {
    const res = await fetch(`${parsed.url}/api/extension/session`, { credentials: "include" });
    const data = (await res.json()) as { signedIn?: unknown };
    if (!res.ok || typeof data.signedIn !== "boolean") throw new Error("not an Echo server");
  } catch {
    if (!server || originPattern(server) !== pattern) await chrome.permissions.remove({ origins: [pattern] }).catch(() => false);
    return setStatus(status, `That address didn't answer like a ${APP_NAME} server. Check it and try again.`, true);
  }
  // Moving to another server gives up access to the old one (a built-in one stays).
  if (server && server !== BUILT_IN_URL && originPattern(server) !== pattern) {
    await chrome.permissions.remove({ origins: [originPattern(server)] }).catch(() => false);
  }
  await setServerUrl(parsed.url);
  location.reload();
}

$("connectServer").addEventListener("click", () => void connectServer());
$("serverUrl").addEventListener("keydown", (e) => {
  if (e.key === "Enter") void connectServer();
});
$("cancelConnect").addEventListener("click", () => location.reload());
$("changeServer").addEventListener("click", () => showConnect(true));

// ── Start ────────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  server = await getServerUrl();
  if (!(await serverReady(server))) return showConnect(false);
  ($("signin") as HTMLAnchorElement).href = `${server}/login`;
  ($("allDrafts") as HTMLAnchorElement).href = `${server}/drafts`;
  const changeServer = $("changeServer");
  changeServer.title = `Change server (now ${hostOf(server!)})`;
  changeServer.hidden = false;
  $("who").hidden = false;
  $("main").hidden = false;
  await Promise.all([checkSession(), loadPage()]);
  await refresh();
}

void start();
