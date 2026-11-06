import { useEffect, useSyncExternalStore } from "react";

import { API_URL } from "@/api/client";
import { isOnline, reportNetwork, subscribeNetwork } from "@/api/network";

const PING_INTERVAL_MS = 15000;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let consumers = 0;

async function ping(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${API_URL}/actuator/health`, { method: "GET", signal: controller.signal });
    reportNetwork(true);
  } catch {
    reportNetwork(false);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether the backend is reachable: updated by every API request, plus a lightweight
 * health ping every 15 s while offline so the app notices when the network returns.
 */
export function useOnline(): boolean {
  const online = useSyncExternalStore(subscribeNetwork, isOnline, isOnline);

  useEffect(() => {
    consumers += 1;
    return () => {
      consumers -= 1;
      if (consumers === 0 && pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };
  }, []);

  useEffect(() => {
    if (online) {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    } else if (!pingTimer) {
      pingTimer = setInterval(ping, PING_INTERVAL_MS);
    }
  }, [online]);

  return online;
}
