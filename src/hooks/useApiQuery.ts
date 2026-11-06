import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { onQueueSynced } from "@/features/offline/sync";

import { cacheKey, readCache, readMemory, writeCache } from "./queryCache";

export type ApiQueryResult<T> = {
  data: T | undefined;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** True when the data shown comes from the cache because the last fetch failed. */
  stale: boolean;
  refetch: () => Promise<void>;
};

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

/**
 * Fetches data with a stale-while-revalidate cache keyed by user id + `key`: the last
 * known data shows immediately (also offline), then the fresh response replaces it.
 */
export function useApiQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: { enabled?: boolean }
): ApiQueryResult<T> {
  const enabled = options?.enabled ?? true;
  const fullKey = cacheKey(key);
  const initial = readMemory(fullKey);

  const [data, setData] = useState<T | undefined>(initial?.data as T | undefined);
  const [loading, setLoading] = useState<boolean>(enabled && !initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // Latest fetcher without re-running the query when the caller passes a new closure.
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });
  const requestId = useRef(0);
  const hasData = useRef(initial !== undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: "initial" | "refresh") => {
      const id = ++requestId.current;
      if (mode === "refresh") setRefreshing(true);
      else if (!hasData.current) setLoading(true);
      try {
        const result = await fetcherRef.current();
        if (!mounted.current || id !== requestId.current) return;
        hasData.current = true;
        setData(result);
        setError(null);
        setStale(false);
        void writeCache(fullKey, result);
      } catch (e) {
        if (!mounted.current || id !== requestId.current) return;
        setError(messageOf(e));
        setStale(hasData.current);
      } finally {
        if (mounted.current && id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fullKey]
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const cached = await readCache(fullKey);
      if (cancelled) return;
      if (cached) {
        hasData.current = true;
        setData(cached.data as T);
        setLoading(false);
      } else {
        hasData.current = false;
        setData(undefined);
      }
      await run("initial");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey, enabled, run, ...deps]);

  // Offline actions just sent to the server: the data is reloaded silently (no spinner).
  useEffect(() => {
    if (!enabled) return;
    return onQueueSynced(() => void run("initial"));
  }, [enabled, run]);

  const refetch = useCallback(() => run("refresh"), [run]);

  return { data, loading: enabled && loading, refreshing, error, stale, refetch };
}
