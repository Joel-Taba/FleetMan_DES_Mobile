// Pure rules of the offline action queue: which requests may wait for the network, how a failed
// replay is classified, the retry delays and the replay order. No React Native import here, so
// the module runs as is under `node --test` (see scripts/offline-rules.test.mjs).

export type QueueMethod = "POST" | "PUT" | "PATCH" | "DELETE";

/** Driver actions that make sense offline (allow-list, everything else fails as before). */
export type OfflineKind =
  | "fuel"
  | "maintenance"
  | "incident"
  | "incidentComment"
  | "stopArrive"
  | "stopComplete"
  | "stopFail"
  | "submission"
  | "acknowledge"
  | "vehicleOperational"
  | "message"
  | "expense";

const ID = "[^/]+";
const RULES: { kind: OfflineKind; method: QueueMethod; pattern: RegExp }[] = [
  { kind: "fuel", method: "POST", pattern: /^\/api\/v1\/operations\/fuel-recharges$/ },
  { kind: "maintenance", method: "POST", pattern: /^\/api\/v1\/operations\/maintenances$/ },
  { kind: "incident", method: "POST", pattern: /^\/api\/v1\/operations\/incidents$/ },
  { kind: "incidentComment", method: "POST", pattern: new RegExp(`^/api/v1/operations/incidents/${ID}/comments$`) },
  { kind: "stopArrive", method: "POST", pattern: new RegExp(`^/api/v1/trips/${ID}/stops/${ID}/arrive$`) },
  { kind: "stopComplete", method: "POST", pattern: new RegExp(`^/api/v1/trips/${ID}/stops/${ID}/complete$`) },
  { kind: "stopFail", method: "POST", pattern: new RegExp(`^/api/v1/trips/${ID}/stops/${ID}/fail$`) },
  { kind: "submission", method: "POST", pattern: new RegExp(`^/api/v1/trips/${ID}/submissions$`) },
  { kind: "acknowledge", method: "POST", pattern: new RegExp(`^/api/v1/assignments/${ID}/acknowledge$`) },
  { kind: "vehicleOperational", method: "PATCH", pattern: new RegExp(`^/api/v1/vehicles/${ID}/operational$`) },
  { kind: "message", method: "POST", pattern: /^\/api\/v1\/messages\/mine$/ },
  { kind: "expense", method: "POST", pattern: /^\/api\/v1\/budget\/expenses$/ },
];

/** Path without origin, query string or trailing slash (`https://host/api/v1/x/?a=1` → `/api/v1/x`). */
export function normalizePath(path: string): string {
  const noOrigin = path.replace(/^https?:\/\/[^/]+/, "");
  const noQuery = noOrigin.split(/[?#]/)[0];
  return noQuery.length > 1 ? noQuery.replace(/\/+$/, "") : noQuery;
}

/** Kind of an allowed offline action, or null when the request must not be queued. */
export function matchOfflineAction(method: string, path: string): OfflineKind | null {
  const m = method.toUpperCase();
  const p = normalizePath(path);
  return RULES.find((rule) => rule.method === m && rule.pattern.test(p))?.kind ?? null;
}

/**
 * Outcome of a failed replay:
 * - `network`: no HTTP answer (status 0): keep, retry with backoff, stop the run (order kept);
 * - `auth`: session missing or expired (401): keep, wait for a new login;
 * - `server`: temporary server trouble (5xx, 408, 425, 429): retry a few times with backoff;
 * - `refused`: business refusal (other 4xx): moved to the failed list with the server detail.
 */
export type FailureClass = "network" | "auth" | "server" | "refused";

const SESSION_CODES = new Set(["AUTH_002", "AUTH_003", "AUTH_005"]);
const TRANSIENT_4XX = new Set([408, 425, 429]);

export function classifyFailure(status: number | undefined | null, code?: string | null): FailureClass {
  if (!status || status <= 0) return "network";
  if (status === 401 || (code && SESSION_CODES.has(code))) return "auth";
  if (status >= 500 || TRANSIENT_4XX.has(status)) return "server";
  if (status >= 400) return "refused";
  return "server";
}

/** After this many temporary server errors in a row, the action goes to the failed list. */
export const MAX_SERVER_ATTEMPTS = 5;

/** Periodic retry while actions are pending. */
export const RETRY_INTERVAL_MS = 30_000;

const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

/** Delay before the next automatic try after `attempts` failed tries (1 → 5 s … capped at 5 min). */
export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
}

export type QueueState = "pending" | "failed";

export type QueueItem = {
  /** Client id, also sent as `Idempotency-Key` (UUID v4): a replay never creates a duplicate. */
  id: string;
  userId: string;
  kind: OfflineKind;
  method: QueueMethod;
  path: string;
  body?: unknown;
  createdAt: number;
  /** Tie-breaker for items created in the same millisecond. */
  seq: number;
  attempts: number;
  lastError?: string | null;
  lastStatus?: number | null;
  /** Epoch ms before which the periodic retry leaves the item alone (0 = due now). */
  nextAttemptAt: number;
  state: QueueState;
};

/** Replay order: oldest first. */
export function compareItems(a: QueueItem, b: QueueItem): number {
  return a.createdAt - b.createdAt || a.seq - b.seq;
}

export function pendingOf(items: QueueItem[], userId: string | null | undefined): QueueItem[] {
  if (!userId) return [];
  return items.filter((i) => i.userId === userId && i.state === "pending").sort(compareItems);
}

export function failedOf(items: QueueItem[], userId: string | null | undefined): QueueItem[] {
  if (!userId) return [];
  return items.filter((i) => i.userId === userId && i.state === "failed").sort(compareItems);
}

/**
 * Next item to replay for this user: always the oldest pending one (actions keep their order,
 * e.g. arrival before delivery). Null when none, or when it is still waiting for its backoff
 * (unless `force`, used when the network returns or the driver taps "retry").
 */
export function nextToReplay(items: QueueItem[], userId: string | null | undefined, now: number, force = false): QueueItem | null {
  const head = pendingOf(items, userId)[0];
  if (!head) return null;
  return force || head.nextAttemptAt <= now ? head : null;
}

/** New state of an item after a failed replay. */
export function afterFailure(item: QueueItem, failure: FailureClass, message: string, status: number | null, now: number): QueueItem {
  const attempts = item.attempts + 1;
  const base = { ...item, attempts, lastError: message, lastStatus: status };
  if (failure === "refused") return { ...base, state: "failed", nextAttemptAt: 0 };
  if (failure === "server" && attempts >= MAX_SERVER_ATTEMPTS) return { ...base, state: "failed", nextAttemptAt: 0 };
  // Session problem: no backoff, the replay resumes as soon as the driver is logged in again.
  if (failure === "auth") return { ...base, attempts: item.attempts, nextAttemptAt: 0 };
  return { ...base, nextAttemptAt: now + backoffMs(attempts) };
}

/** UUID v4 (the backend rejects any other Idempotency-Key format). */
export function createClientId(random: () => number = Math.random): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (random === Math.random && typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  const hex = [...Array(32)].map(() => Math.floor(random() * 16));
  hex[12] = 4;
  hex[16] = (hex[16] & 0x3) | 0x8;
  const s = hex.map((n) => n.toString(16)).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Result of an allowed action saved for later because the network is missing. */
export type QueuedResult = { queued: true; clientId: string; kind: OfflineKind };

export function isQueued(value: unknown): value is QueuedResult {
  return typeof value === "object" && value !== null && (value as { queued?: unknown }).queued === true && "clientId" in value;
}
