import AsyncStorage from "@react-native-async-storage/async-storage";

import { secureDelete, secureGet, secureSet } from "./storage";
import type { AuthPayloadUser, AuthSession, AuthUser } from "./types";

// Session state shared by the API client (tokens) and the AuthProvider (user).
// Kept outside React so apiFetch can read and renew tokens anywhere.

const ACCESS_KEY = "fm.accessToken";
const REFRESH_KEY = "fm.refreshToken";
const USER_KEY = "fm:user";

let session: AuthSession | null = null;
const invalidationListeners = new Set<(message?: string) => void>();
const userListeners = new Set<(user: AuthUser | null) => void>();

function clean(value?: string | null): string {
  return value && value !== "null" ? value : "";
}

/** Normalizes the backend user payload (same rules as the web front). */
export function mapAuthUser(data: AuthPayloadUser): AuthUser {
  return {
    id: data.id,
    username: clean(data.username) || clean(data.email).split("@")[0] || data.id,
    email: clean(data.email),
    phone: clean(data.phone) || undefined,
    firstName: clean(data.firstName),
    lastName: clean(data.lastName),
    roles: data.roles ?? [],
    photoUrl: clean(data.photoUrl) || undefined,
  };
}

export function getSession(): AuthSession | null {
  return session;
}

export function getAccessToken(): string | null {
  return session?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return session?.refreshToken || null;
}

export function getSessionUser(): AuthUser | null {
  return session?.user ?? null;
}

export async function loadSession(): Promise<AuthSession | null> {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    secureGet(ACCESS_KEY),
    secureGet(REFRESH_KEY),
    AsyncStorage.getItem(USER_KEY).catch(() => null),
  ]);
  if (!accessToken || !rawUser) return null;
  try {
    session = { accessToken, refreshToken: refreshToken ?? "", user: JSON.parse(rawUser) as AuthUser };
    return session;
  } catch {
    return null;
  }
}

export async function saveSession(next: AuthSession): Promise<void> {
  session = next;
  userListeners.forEach((listener) => listener(next.user));
  await Promise.all([
    secureSet(ACCESS_KEY, next.accessToken),
    next.refreshToken ? secureSet(REFRESH_KEY, next.refreshToken) : secureDelete(REFRESH_KEY),
    AsyncStorage.setItem(USER_KEY, JSON.stringify(next.user)).catch(() => undefined),
  ]);
}

/** Merges a partial user into the session (keys set to `undefined` are ignored). */
export function updateSessionUser(patch: Partial<AuthUser>): AuthUser | null {
  if (!session) return null;
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const user = { ...session.user, ...defined };
  session = { ...session, user };
  userListeners.forEach((listener) => listener(user));
  AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => undefined);
  return user;
}

export async function clearSession(): Promise<void> {
  session = null;
  userListeners.forEach((listener) => listener(null));
  await Promise.all([
    secureDelete(ACCESS_KEY),
    secureDelete(REFRESH_KEY),
    AsyncStorage.removeItem(USER_KEY).catch(() => undefined),
  ]);
}

/** Called by the API client when the session can no longer be used (expired, revoked). */
let invalidationNotice: string | null = null;

export function invalidateSession(message?: string): void {
  if (!session) return;
  invalidationNotice = message ?? null;
  void clearSession();
  invalidationListeners.forEach((listener) => listener(message));
}

/** Reason of the last forced logout (shown once on the login screen). */
export function consumeInvalidationNotice(): string | null {
  const notice = invalidationNotice;
  invalidationNotice = null;
  return notice;
}

export function onSessionInvalidated(listener: (message?: string) => void): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

/** Notified on every user change (login, profile update, logout). */
export function onSessionUserChange(listener: (user: AuthUser | null) => void): () => void {
  userListeners.add(listener);
  return () => userListeners.delete(listener);
}

/** Expiry (seconds since epoch) read from the JWT payload, or null when unreadable. */
export function tokenExpiry(token: string | null): number | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part || typeof globalThis.atob !== "function") return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(globalThis.atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null, skewSeconds = 0): boolean {
  const exp = tokenExpiry(token);
  return exp != null && exp - skewSeconds <= Date.now() / 1000;
}
