import * as Location from "expo-location";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { getSessionUser } from "@/auth/session";
import { readTrackingConsent, saveTrackingConsent, type TrackingConsent } from "./consent";
import {
  getTrackingState,
  retryTrackingNow,
  startTracking,
  stopTracking,
  subscribeTracking,
  type TrackingState,
} from "./tracker";

/** Trajet « en cours » : départ enregistré (DEPARTED) ou arrivé à destination (ARRIVED). */
export function isTrackableTrip(status: string | null | undefined): boolean {
  return status === "DEPARTED" || status === "ARRIVED";
}

export type TripTracking = {
  state: TrackingState;
  /** null tant que le choix n'est pas lu ; "unset" si le chauffeur n'a jamais répondu. */
  consent: TrackingConsent | "unset" | null;
  /** La permission a été refusée et ne peut plus être demandée : réglages du téléphone. */
  blocked: boolean;
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

/**
 * Partage de position pour le trajet affiché : démarre seul si le chauffeur l'a déjà accepté et que
 * le trajet est en cours, s'arrête quand le trajet ne l'est plus. Quitter l'écran ne l'arrête pas.
 */
export function useTripTracking(tripId: string | null | undefined, tripStatus: string | null | undefined): TripTracking {
  const state = useSyncExternalStore(subscribeTracking, getTrackingState, getTrackingState);
  const userId = getSessionUser()?.id ?? null;
  const [consent, setConsent] = useState<TrackingConsent | "unset" | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = Boolean(tripId) && isTrackableTrip(tripStatus);

  useEffect(() => {
    let cancelled = false;
    void readTrackingConsent(userId).then((value) => {
      if (!cancelled) setConsent(value ?? "unset");
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Permission retirée ou rendue depuis les réglages : relue à l'affichage et au retour dans l'app.
  useEffect(() => {
    let cancelled = false;
    const check = (retry: boolean) =>
      Location.getForegroundPermissionsAsync().then(
        (perm) => {
          if (cancelled) return;
          setBlocked(!perm.granted && !perm.canAskAgain);
          if (retry && perm.granted && getTrackingState().status === "denied") retryTrackingNow();
        },
        () => undefined
      );
    void check(false);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void check(true);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!tripId || consent === null) return;
    if (active && consent === "granted") {
      startTracking(tripId);
    } else if (!active && getTrackingState().tripId === tripId) {
      stopTracking();
    }
  }, [active, consent, tripId]);

  const enable = useCallback(async () => {
    if (!tripId) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      setBlocked(!perm.granted && !perm.canAskAgain);
      await saveTrackingConsent(userId, "granted");
      setConsent("granted");
      if (active) startTracking(tripId);
    } catch {
      setBlocked(false);
    } finally {
      setBusy(false);
    }
  }, [active, tripId, userId]);

  const disable = useCallback(async () => {
    await saveTrackingConsent(userId, "declined");
    setConsent("declined");
    stopTracking();
  }, [userId]);

  return { state, consent, blocked, busy, enable, disable };
}
