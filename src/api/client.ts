import { AppState } from "react-native";

import { tr } from "@/i18n/core";
import {
  getAccessToken,
  getRefreshToken,
  getSession,
  getSessionUser,
  invalidateSession,
  isTokenExpired,
  loadSession,
  mapAuthUser,
  saveSession,
} from "@/auth/session";
import type { AuthPayload } from "@/auth/types";
import { enqueueAction, hasPendingFor, hydrateQueue } from "@/features/offline/queue";
import { createClientId, matchOfflineAction, type QueuedResult, type QueueMethod } from "@/features/offline/rules";

import { isOnline, reportNetwork } from "./network";

export { isQueued, type QueuedResult } from "@/features/offline/rules";

/** Result of an allowed driver action that may have been saved offline instead of sent. */
export type MaybeQueued<T> = T | QueuedResult;

/**
 * FleetMan Spring Boot backend (same backend as the web front). On a phone, localhost is
 * the phone itself: set EXPO_PUBLIC_API_URL to the computer's LAN IP (see README).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8081").replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  status: number;
  /** Business code returned by the backend (e.g. `AUTH_006`, `PLN_021`), when present. */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number?: number;
  size?: number;
  last?: boolean;
  first?: boolean;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiFetchInit = {
  method?: Method;
  body?: unknown;
  /** Sends the Bearer token (default true). */
  auth?: boolean;
  headers?: Record<string, string>;
};

/** Common-core envelope `{ success, message, data, timestamp }`. */
type ApiEnvelope<T> = { success: boolean; message?: string | null; data: T; timestamp?: string };

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    "data" in value &&
    typeof (value as ApiEnvelope<unknown>).success === "boolean"
  );
}

export function unwrapApiData<T>(body: unknown): T {
  if (isEnvelope(body)) {
    if (body.success === false) throw new ApiError(body.message ?? tr("Erreur API"), 400);
    return body.data as T;
  }
  return body as T;
}

function networkError(): ApiError {
  return new ApiError(tr("Connexion au serveur impossible."), 0);
}

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    reportNetwork(true);
    return res;
  } catch {
    reportNetwork(false);
    throw networkError();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Outcome of a token renewal:
 * - "ok": a usable access token is in the session (renewed here or by a concurrent call);
 * - "invalid": the refresh token is definitely refused (expired / revoked): only case
 *   where the driver must log in again;
 * - "transient": no network, backend / Kernel unavailable (5xx): the session is kept
 *   and renewal is retried later, without logging the driver out.
 */
export type RefreshOutcome = "ok" | "invalid" | "transient";

/** A token renewed elsewhere is reused when it still has at least this much time left. */
const FRESH_ENOUGH_SECONDS = 120;
/** Renewal window before expiry (before each request and in the keep-alive timer). */
const PROACTIVE_REFRESH_SECONDS = 120;

let refreshInFlight: Promise<RefreshOutcome> | null = null;

function renewedElsewhere(staleToken: string | null): boolean {
  const current = getAccessToken();
  return !!staleToken && !!current && current !== staleToken && !isTokenExpired(current, FRESH_ENOUGH_SECONDS);
}

async function performRefresh(staleToken: string | null): Promise<RefreshOutcome> {
  if (renewedElsewhere(staleToken)) return "ok";
  const refreshToken = getRefreshToken();
  const current = getSession();
  if (!refreshToken || !current) return "invalid";

  let res: Response;
  try {
    res = await rawFetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return "transient";
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    // Web build with several tabs: another tab may have rotated the refresh token
    // (rotating tokens: the one we sent is now consumed). Adopt the stored one.
    const stored = await loadSession().catch(() => null);
    if (stored && stored.refreshToken && stored.refreshToken !== refreshToken && !isTokenExpired(stored.accessToken, 0)) {
      return "ok";
    }
    return "invalid";
  }
  if (!res.ok) return "transient";

  try {
    const text = await res.text();
    if (!text.trim()) return "transient";
    const data = unwrapApiData<AuthPayload>(JSON.parse(text));
    if (!data?.accessToken) return "transient";
    const base = getSession() ?? current;
    const incoming = data.user ? mapAuthUser(data.user) : null;
    await saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      user: incoming
        ? {
            ...base.user,
            ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== "" && v != null)),
            roles: incoming.roles.length > 0 ? incoming.roles : base.user.roles,
          }
        : base.user,
    });
    return "ok";
  } catch {
    return "transient";
  }
}

/**
 * Renews the session with the stored refresh token. One request at a time: concurrent
 * callers share it. `staleToken` is the access token that was just refused (or judged
 * too close to expiry): when the session already holds another fresh token, nothing is sent.
 */
export function refreshSession(staleToken?: string | null): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;
  const stale = staleToken ?? getAccessToken();
  if (renewedElsewhere(stale)) return Promise.resolve("ok");
  const promise = performRefresh(stale)
    .catch((): RefreshOutcome => "transient")
    .finally(() => {
      if (refreshInFlight === promise) refreshInFlight = null;
    });
  refreshInFlight = promise;
  return promise;
}

/** Renews the access token with the stored refresh token (one request at a time). */
export async function refreshAccessToken(): Promise<boolean> {
  return (await refreshSession()) === "ok";
}

/** Renews the token ahead of expiry when a refresh token is available. */
async function proactiveRefresh(): Promise<void> {
  const token = getAccessToken();
  if (token && getRefreshToken() && isTokenExpired(token, PROACTIVE_REFRESH_SECONDS)) {
    await refreshSession(token);
  }
}

type AuthorizedResult = { res: Response; outcome?: RefreshOutcome };

/**
 * Authenticated fetch: proactive renewal, then on 401 a direct replay when the token
 * was already renewed meanwhile, otherwise one shared refresh and one replay.
 */
async function fetchWithAuth(url: string, init: RequestInit, auth: boolean): Promise<AuthorizedResult> {
  if (auth) await proactiveRefresh();
  let usedToken: string | null = null;
  const doFetch = () => {
    const headers = new Headers(init.headers);
    if (auth) {
      usedToken = getAccessToken();
      if (usedToken) headers.set("Authorization", `Bearer ${usedToken}`);
    }
    return rawFetch(url, { ...init, headers });
  };

  let res = await doFetch();
  let outcome: RefreshOutcome | undefined;
  if (auth && res.status === 401 && usedToken) {
    const current = getAccessToken();
    if (current && current !== usedToken && !isTokenExpired(current, 0)) {
      res = await doFetch();
    } else {
      outcome = await refreshSession(usedToken);
      if (outcome === "ok") res = await doFetch();
    }
  }
  return { res, outcome };
}

/**
 * `fetch` with the Bearer token, silent renewal and one replay on 401, for calls that
 * need the raw Response (protected files shown as blob: URLs on web…).
 */
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const resolved = /^https?:\/\//.test(url) ? url : `${API_URL}${url}`;
  return (await fetchWithAuth(resolved, init, true)).res;
}

/**
 * Keeps the session alive while the app is used: renews the access token shortly
 * before it expires (periodic check) and when the app comes back to the foreground.
 * Logs out only when the refresh token is definitely refused and the token is expired.
 * Returns the cleanup function.
 */
export function startSessionKeepAlive(): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const token = getAccessToken();
    if (!token || !getRefreshToken() || !isTokenExpired(token, PROACTIVE_REFRESH_SECONDS)) return;
    busy = true;
    try {
      const outcome = await refreshSession(token);
      if (outcome === "invalid" && getAccessToken() === token && isTokenExpired(token, 0)) {
        invalidateSession(tr("Session expirée. Veuillez vous reconnecter."));
      }
    } finally {
      busy = false;
    }
  };
  void tick();
  const interval = setInterval(() => void tick(), 30 * 1000);
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void tick();
  });
  return () => {
    clearInterval(interval);
    subscription.remove();
  };
}

async function parseErrorBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const body = await res.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** ProblemDetail: message in `detail` (fallback `message`), business code in `code`. */
function errorFromResponse(status: number, body: Record<string, unknown>): ApiError {
  const detail = body.detail ?? body.message ?? body.error;
  const message = typeof detail === "string" && detail.trim() ? tr(detail) : `${tr("Erreur")} ${status}`;
  return new ApiError(message, status, typeof body.code === "string" ? body.code : undefined);
}

async function request<T>(path: string, method: Method, body: BodyInit | undefined, auth: boolean, headers: Record<string, string>): Promise<T> {
  const url = /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;

  const { res, outcome } = await fetchWithAuth(
    url,
    { method, headers: { Accept: "application/json", ...headers }, body },
    auth
  );

  if (!res.ok) {
    const errorBody = await parseErrorBody(res);
    const error = errorFromResponse(res.status, errorBody);
    // Logged out only when the session is really lost: account suspended/closed, or a
    // 401 whose renewal was definitely refused. A network / server incident during the
    // renewal ("transient") keeps the session; the next call retries.
    const sessionLost =
      error.code === "AUTH_002" ||
      error.code === "AUTH_003" ||
      (res.status === 401 && outcome === "invalid") ||
      (error.code === "AUTH_005" && outcome === undefined && !getRefreshToken());
    if (auth && sessionLost) {
      invalidateSession(error.message);
      if (res.status === 401 && !error.code) error.message = tr("Session expirée. Veuillez vous reconnecter.");
    }
    throw error;
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  const text = await res.text();
  if (!text || !text.trim()) return undefined as T;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text as unknown as T;
  }
  return unwrapApiData<T>(parsed);
}

/**
 * JSON request to the FleetMan backend: Bearer token, envelope unwrap, one
 * refresh-and-retry on 401, `undefined` for empty responses, ApiError otherwise.
 */
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { method = "GET", body, auth = true, headers = {} } = init;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = { ...headers };
  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isForm) {
      payload = body as FormData;
    } else {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      if (!Object.keys(finalHeaders).some((h) => h.toLowerCase() === "content-type")) {
        finalHeaders["Content-Type"] = "application/json";
      }
    }
  }

  // Driver actions of the offline allow-list (features/offline/rules.ts): sent with an
  // Idempotency-Key, and kept in the offline queue instead of failing when the network is missing.
  const kind = auth && !isForm && method !== "GET" ? matchOfflineAction(method, path) : null;
  const userId = getSessionUser()?.id;
  if (kind && userId) {
    const keyHeader = Object.keys(finalHeaders).find((h) => h.toLowerCase() === "idempotency-key");
    const clientId = keyHeader ? finalHeaders[keyHeader] : createClientId();
    if (!keyHeader) finalHeaders["Idempotency-Key"] = clientId;
    const queue = async (): Promise<T> => {
      const jsonBody = typeof body === "string" ? safeJson(body) : body ?? undefined;
      await enqueueAction({ id: clientId, userId, kind, method: method as QueueMethod, path, body: jsonBody });
      return { queued: true, clientId, kind } satisfies QueuedResult as unknown as T;
    };
    await hydrateQueue();
    // Offline, or older actions still waiting: this one waits behind them (order is kept).
    if (!isOnline() || hasPendingFor(userId)) return queue();
    try {
      return await request<T>(path, method, payload, auth, finalHeaders);
    } catch (err) {
      // No HTTP answer at all: saved for later. A refusal from the server is thrown as usual.
      if (err instanceof ApiError && err.status === 0) return queue();
      throw err;
    }
  }

  return request<T>(path, method, payload, auth, finalHeaders);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Replay of a queued action (sync engine): same path, body and Idempotency-Key as the first try. */
export function sendQueuedRequest<T>(method: QueueMethod, path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const headers: Record<string, string> = { "Idempotency-Key": idempotencyKey };
  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    payload = typeof body === "string" ? body : JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  return request<T>(path, method, payload, true, headers);
}

/** Files are not queued offline: the driver adds them once connected. */
export function offlineUploadError(): ApiError {
  return new ApiError(tr("Hors ligne : ajoutez la photo une fois connecté."), 0, "OFFLINE_UPLOAD");
}

/** multipart/form-data upload (the runtime sets the boundary header itself). Not queued offline. */
export async function apiUpload<T>(path: string, form: FormData, method: "POST" | "PUT" | "PATCH" = "POST"): Promise<T> {
  if (!isOnline()) throw offlineUploadError();
  try {
    return await request<T>(path, method, form, true, {});
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) throw offlineUploadError();
    throw err;
  }
}

/** Absolute URL of a backend file path (`/api/v1/files/...`). */
export function resolveFileUrl(url?: string | null): string {
  if (!url) return "";
  if (/^(https?:|blob:|data:|file:)/.test(url)) return url;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/** True when the file is served (and protected) by the backend: it needs the Bearer token. */
export function isProtectedFile(url?: string | null): boolean {
  const resolved = resolveFileUrl(url);
  return resolved.startsWith(`${API_URL}/api/v1/files/`);
}
