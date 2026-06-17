// Thin fetch wrapper that injects the bearer token and parses errors.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "phonograph_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: URLSearchParams;
  formData?: FormData;
  auth?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, formData, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (formData) {
    // Let the browser set the multipart boundary Content-Type.
    payload = formData;
  } else if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — most likely an HTML error page from an upstream proxy (e.g. Cloudflare 502).
    // Log enough context to diagnose, then fall through to the !res.ok branch below.
    console.error(
      `[api] non-JSON response: ${method} ${path} → HTTP ${res.status}`,
      { contentType: res.headers.get("content-type"), body: text.slice(0, 200) },
    );
  }

  if (!res.ok) {
    const body = data as Record<string, unknown> | null;
    const detail = (body && (body.detail || body.message)) || res.statusText || "Request failed";
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

// Fetch a protected binary resource (e.g. a bug-report image) as a Blob, with
// the bearer token attached — so <img> can render it without leaking a URL.
export async function apiBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, "Failed to load image");
  return res.blob();
}
