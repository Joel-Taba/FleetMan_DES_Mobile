// Reachability of the backend, derived from the outcome of API requests: any HTTP
// response means "online", a network failure means "offline". Read with useOnline().

let online = true;
const listeners = new Set<() => void>();

export function isOnline(): boolean {
  return online;
}

export function reportNetwork(reachable: boolean): void {
  if (reachable === online) return;
  online = reachable;
  listeners.forEach((listener) => listener());
}

export function subscribeNetwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
