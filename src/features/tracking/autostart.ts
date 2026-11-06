import * as Location from "expo-location";
import { useEffect } from "react";

import { fetchMyActiveTrip } from "@/api/driver";
import { getSessionUser, onSessionUserChange } from "@/auth/session";
import { readTrackingConsent } from "./consent";
import { getTrackingState, startTracking } from "./tracker";
import { isTrackableTrip } from "./useTripTracking";

/**
 * Reprend le partage au lancement de l'app (ou à la connexion) si le chauffeur l'a accepté, que la
 * permission est accordée et qu'un trajet est en cours. Sans effet sinon ; aucune demande affichée.
 */
export async function resumeTrackingIfActive(): Promise<void> {
  try {
    const user = getSessionUser();
    if (!user || getTrackingState().tripId) return;
    if ((await readTrackingConsent(user.id)) !== "granted") return;
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return;
    const trip = await fetchMyActiveTrip();
    if (trip && isTrackableTrip(trip.status)) startTracking(trip.id);
  } catch {
    // Hors ligne ou session expirée : l'écran de la tournée relancera le partage.
  }
}

/** À monter une fois dans la mise en page racine pour reprendre le partage dès le lancement. */
export function useTrackingAutostart() {
  useEffect(() => {
    void resumeTrackingIfActive();
    return onSessionUserChange((user) => {
      if (user) void resumeTrackingIfActive();
    });
  }, []);
}
