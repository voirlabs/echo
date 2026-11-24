import { getServerUrl, hostOf } from "./server";

// Calls to the user's Echo server (shared/server.ts). The extension holds host
// permission for it, so requests carry the user's session cookie.

export const APP_NAME = "__APP_NAME__";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = await getServerUrl();
  if (!base) throw new ApiError(`Connect the extension to your ${APP_NAME} server first.`, 0);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Couldn't reach ${hostOf(base)}. Check your connection.`, 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status}).`, res.status);
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const base = await getServerUrl();
  if (!base) throw new ApiError(`Connect the extension to your ${APP_NAME} server first.`, 0);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { credentials: "include" });
  } catch {
    throw new ApiError(`Couldn't reach ${hostOf(base)}. Check your connection.`, 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status}).`, res.status);
  return data as T;
}

interface Session { signedIn?: boolean }
export interface Draft {
  key: string;
  title: string;
  text: string;
  /** A page request: "requested", "drafting" (the assistant has it) or "ready". */
  status: "requested" | "drafting" | "ready";
  /** The page's fields and their drafted values. */
  fields: { id: string; label: string; selector: string; value: string }[];
}

/** Sign-in status, the draft for a page, and asking for a page to be drafted. */
export const api = {
  session: () => get<Session>("/api/extension/session"),
  draft: (pageUrl: string) => get<{ draft: Draft | null }>(`/api/extension/drafts?url=${encodeURIComponent(pageUrl)}`),
  request: (page: { url: string; title: string; pageText: string; fields: unknown[] }) => post<{ key: string }>("/api/extension/requests", page),
};
