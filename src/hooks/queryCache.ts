import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSessionUser } from "@/auth/session";

// Stale-while-revalidate cache of API responses: in memory for instant re-renders and
// in AsyncStorage (per user) so screens still show the last known data offline.

const PREFIX = "fm:q:";

type Entry = { data: unknown; at: number };

const memory = new Map<string, Entry>();

export function cacheKey(key: string): string {
  return `${PREFIX}${getSessionUser()?.id ?? "anon"}:${key}`;
}

export function readMemory(fullKey: string): Entry | undefined {
  return memory.get(fullKey);
}

export async function readCache(fullKey: string): Promise<Entry | undefined> {
  const hit = memory.get(fullKey);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(fullKey);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry;
    memory.set(fullKey, entry);
    return entry;
  } catch {
    return undefined;
  }
}

export async function writeCache(fullKey: string, data: unknown): Promise<void> {
  const entry = { data, at: Date.now() };
  memory.set(fullKey, entry);
  try {
    await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {
    /* quota or storage unavailable: memory cache only */
  }
}

/** Forgets cached responses of one user (all users when omitted), e.g. on logout. */
export async function clearQueryCache(userId?: string): Promise<void> {
  const prefix = userId ? `${PREFIX}${userId}:` : PREFIX;
  [...memory.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => memory.delete(k));
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    /* ignore */
  }
}
