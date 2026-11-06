// Replay of the offline queue: one action at a time, oldest first, when the network returns,
// when the app comes back to the foreground, after each login and every 30 s while actions wait.
import { AppState } from "react-native";

import { ApiError, sendQueuedRequest } from "@/api/client";
import { isOnline, subscribeNetwork } from "@/api/network";
import { getAccessToken, getSessionUser, onSessionUserChange } from "@/auth/session";
import { tr } from "@/i18n/core";

import {
  clearBackoff,
  getQueueSnapshot,
  hydrateQueue,
  onEnqueued,
  removeItem,
  requeueItem,
  setSyncState,
  subscribeQueue,
  updateItem,
} from "./queue";
import { afterFailure, classifyFailure, nextToReplay, pendingOf, RETRY_INTERVAL_MS, type QueueItem } from "./rules";

const syncedListeners = new Set<(items: QueueItem[]) => void>();

/**
 * Called once a replay run has sent at least one action: screens refetch their data
 * (useApiQuery subscribes to it, so every mounted query reloads silently).
 */
export function onQueueSynced(listener: (items: QueueItem[]) => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

let running: Promise<void> | null = null;
let rerun = false;

/** Sends the pending actions of the logged-in driver. `force` ignores the backoff delay. */
export function flushQueue(force = false): Promise<void> {
  if (running) {
    if (force) rerun = true;
    return running;
  }
  running = (async () => {
    await hydrateQueue();
    const sent: QueueItem[] = [];
    let forceNext = force;
    try {
      for (;;) {
        const userId = getSessionUser()?.id;
        if (!userId || !getAccessToken()) break;
        const item = nextToReplay(getQueueSnapshot().items, userId, Date.now(), forceNext);
        if (!item) break;
        setSyncState({ inFlightId: item.id, syncing: true });
        try {
          await sendQueuedRequest<unknown>(item.method, item.path, item.body, item.id);
          removeItem(item.id);
          sent.push(item);
          // The network answers: the next actions go out right away.
          forceNext = true;
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          const code = err instanceof ApiError ? err.code : undefined;
          const failure = classifyFailure(status, code);
          const message = err instanceof Error && err.message ? err.message : tr("Échec de l'envoi.");
          // The item may have been discarded while it was in flight.
          const current = getQueueSnapshot().items.find((i) => i.id === item.id);
          if (current) updateItem(afterFailure(current, failure, message, status || null, Date.now()));
          // Business refusal: this one is set aside, the next ones still go. Otherwise wait.
          if (failure !== "refused") break;
        }
      }
    } finally {
      setSyncState({ inFlightId: null, syncing: false });
      if (sent.length) syncedListeners.forEach((l) => l(sent));
    }
  })().finally(() => {
    running = null;
    if (rerun) {
      rerun = false;
      void flushQueue(true);
    }
  });
  return running;
}

/** "Retry" on one action: a refused one goes back to the queue, a waiting one is tried now. */
export function retryItem(id: string): Promise<void> {
  const item = getQueueSnapshot().items.find((i) => i.id === id);
  if (!item) return Promise.resolve();
  if (item.state === "failed") requeueItem(id);
  else clearBackoff(id);
  return flushQueue(true);
}

export function discardItem(id: string): void {
  if (getQueueSnapshot().inFlightId === id) return;
  removeItem(id);
}

let stopSync: (() => void) | null = null;

/** Starts the automatic replay (idempotent; called by the app-wide banner). */
export function startOfflineSync(): () => void {
  if (stopSync) return stopSync;
  void hydrateQueue().then(() => flushQueue(true));

  let wasOnline = isOnline();
  const offNetwork = subscribeNetwork(() => {
    const online = isOnline();
    if (online && !wasOnline) void flushQueue(true);
    wasOnline = online;
  });
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") void flushQueue(true);
  });
  const offUser = onSessionUserChange((user) => {
    if (user) void flushQueue(true);
  });
  const offEnqueued = onEnqueued(() => {
    if (isOnline()) void flushQueue();
  });

  // Periodic retry, only while actions wait (also serves as a probe of the network).
  let timer: ReturnType<typeof setInterval> | null = null;
  const updateTimer = () => {
    const waiting = pendingOf(getQueueSnapshot().items, getSessionUser()?.id).length > 0;
    if (waiting && !timer) timer = setInterval(() => void flushQueue(), RETRY_INTERVAL_MS);
    else if (!waiting && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const offQueue = subscribeQueue(updateTimer);
  updateTimer();

  stopSync = () => {
    offNetwork();
    appState.remove();
    offUser();
    offEnqueued();
    offQueue();
    if (timer) clearInterval(timer);
    timer = null;
    stopSync = null;
  };
  return stopSync;
}
