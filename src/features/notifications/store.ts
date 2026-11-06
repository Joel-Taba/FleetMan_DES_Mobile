// Fraîcheur des notifications : compteur de non lues interrogé périodiquement, au retour de
// l'application au premier plan, et dès qu'une notification est lue sur un autre écran.
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { fetchUnreadNotificationCount } from "./api";

type Listener = () => void;
const listeners = new Set<Listener>();
const POLL_MS = 45_000;

/** Prévient la cloche, la barre d'onglets et l'accueil qu'une notification a changé. */
export function signalNotificationsChanged() {
  for (const l of [...listeners]) l();
}

/** Appelle `refresh` toutes les 45 s (app active), au retour au premier plan et à chaque signal. */
export function useNotificationRefresh(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    listeners.add(refresh);
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      listeners.delete(refresh);
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh, enabled]);
}

/** Nombre de notifications non lues du chauffeur connecté. */
export function useUnreadNotificationCount(enabled = true) {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    fetchUnreadNotificationCount()
      .then(setCount)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  useNotificationRefresh(load, enabled);
  return enabled ? count : 0;
}
