// Persistent queue of driver actions waiting for the network (AsyncStorage, all users in one
// entry, each item tagged with its user). Read with useOfflineQueue(), replayed by ./sync.ts.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { compareItems, createClientId, type OfflineKind, type QueueItem, type QueueMethod } from "./rules";

const STORAGE_KEY = "fm:offline-queue:v1";

export type QueueSnapshot = {
  items: QueueItem[];
  /** Id of the item being sent right now (its discard button is disabled meanwhile). */
  inFlightId: string | null;
  syncing: boolean;
};

let snapshot: QueueSnapshot = { items: [], inFlightId: null, syncing: false };
let seq = 0;
const listeners = new Set<() => void>();
const enqueueListeners = new Set<(item: QueueItem) => void>();
let hydration: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function publish(next: Partial<QueueSnapshot>, persist: boolean) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
  if (persist) {
    const data = JSON.stringify(snapshot.items);
    // Writes are chained so an older state never overwrites a newer one.
    writeChain = writeChain
      .then(() => AsyncStorage.setItem(STORAGE_KEY, data))
      .catch(() => undefined);
  }
}

/** Loads the stored queue once (every other function awaits it before reading). */
export function hydrateQueue(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const stored = raw ? (JSON.parse(raw) as QueueItem[]) : [];
        if (Array.isArray(stored) && stored.length) {
          // Items enqueued before the load finished are kept after the stored ones.
          const known = new Set(stored.map((i) => i.id));
          const merged = [...stored, ...snapshot.items.filter((i) => !known.has(i.id))].sort(compareItems);
          seq = merged.reduce((max, i) => Math.max(max, i.seq ?? 0), 0);
          publish({ items: merged }, false);
        }
      } catch {
        /* unreadable storage: start empty, never crash the app */
      }
    })();
  }
  return hydration;
}

export function getQueueSnapshot(): QueueSnapshot {
  return snapshot;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called after each new item (the sync engine replays at once when the network is there). */
export function onEnqueued(listener: (item: QueueItem) => void): () => void {
  enqueueListeners.add(listener);
  return () => enqueueListeners.delete(listener);
}

export async function enqueueAction(input: {
  id?: string;
  userId: string;
  kind: OfflineKind;
  method: QueueMethod;
  path: string;
  body?: unknown;
}): Promise<QueueItem> {
  await hydrateQueue();
  seq += 1;
  const item: QueueItem = {
    id: input.id ?? createClientId(),
    userId: input.userId,
    kind: input.kind,
    method: input.method,
    path: input.path,
    body: input.body,
    createdAt: Date.now(),
    seq,
    attempts: 0,
    lastError: null,
    lastStatus: null,
    nextAttemptAt: 0,
    state: "pending",
  };
  publish({ items: [...snapshot.items.filter((i) => i.id !== item.id), item] }, true);
  await writeChain;
  enqueueListeners.forEach((l) => l(item));
  return item;
}

export function updateItem(next: QueueItem): void {
  if (!snapshot.items.some((i) => i.id === next.id)) return;
  publish({ items: snapshot.items.map((i) => (i.id === next.id ? next : i)) }, true);
}

export function removeItem(id: string): void {
  if (!snapshot.items.some((i) => i.id === id)) return;
  publish({ items: snapshot.items.filter((i) => i.id !== id) }, true);
}

/** Failed item sent back to the pending list (driver tapped "retry"), same idempotency key. */
export function requeueItem(id: string): void {
  const item = snapshot.items.find((i) => i.id === id);
  if (!item) return;
  updateItem({ ...item, state: "pending", attempts: 0, nextAttemptAt: 0 });
}

/** Pending item retried now: its backoff is cleared. */
export function clearBackoff(id: string): void {
  const item = snapshot.items.find((i) => i.id === id);
  if (item && item.nextAttemptAt !== 0) updateItem({ ...item, nextAttemptAt: 0 });
}

export function setSyncState(state: { inFlightId?: string | null; syncing?: boolean }): void {
  publish(state, false);
}

export function hasPendingFor(userId: string | null | undefined): boolean {
  return !!userId && snapshot.items.some((i) => i.userId === userId && i.state === "pending");
}
