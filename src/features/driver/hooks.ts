// Ressources du chauffeur connecté (équivalent de lib/offline/hooks/useDriverResources.ts).
// useApiQuery garde la dernière réponse en cache : l'écran reste lisible hors réseau.
import { useCallback } from "react";
import { useNotificationRefresh } from "@/features/notifications/store";
import { useAuth } from "@/auth/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import {
  fetchAssignedVehicle,
  fetchMyActiveTrip,
  fetchMyAssignments,
  fetchMyAssignmentsToday,
  fetchMyDriverProfile,
  fetchMyNotifications,
  fetchMyTripHistory,
} from "@/api/driver";
import type { ApiDriver, ApiTrip, ApiVehicle, AppNotification, AssignmentResponse, NotificationPage } from "@/api/types";

/** Identifiant chauffeur = identifiant utilisateur de la session (comme le web). */
export function useDriverId(): string {
  const { user } = useAuth();
  return user?.id ? String(user.id) : "";
}

export function useDriverProfile() {
  const driverId = useDriverId();
  return useApiQuery<ApiDriver>(`driver:profile:${driverId}`, () => fetchMyDriverProfile(driverId), [driverId], {
    enabled: Boolean(driverId),
  });
}

export function useDriverActiveTrip() {
  const driverId = useDriverId();
  return useApiQuery<ApiTrip | null>(`driver:active-trip:${driverId}`, () => fetchMyActiveTrip(), [driverId], {
    enabled: Boolean(driverId),
  });
}

export function useDriverAssignments(todayOnly = false) {
  const driverId = useDriverId();
  return useApiQuery<AssignmentResponse[]>(
    `driver:assignments:${todayOnly ? "today" : "all"}:${driverId}`,
    () => (todayOnly ? fetchMyAssignmentsToday(driverId) : fetchMyAssignments(driverId)),
    [driverId, todayOnly],
    { enabled: Boolean(driverId) }
  );
}

export function useDriverTripHistory() {
  const driverId = useDriverId();
  return useApiQuery<ApiTrip[]>(`driver:trip-history:${driverId}`, () => fetchMyTripHistory(), [driverId], {
    enabled: Boolean(driverId),
  });
}

export function useDriverVehicle(vehicleId: string | null | undefined) {
  return useApiQuery<ApiVehicle>(
    `driver:vehicle:${vehicleId ?? "none"}`,
    () => fetchAssignedVehicle(vehicleId as string),
    [vehicleId],
    { enabled: Boolean(vehicleId) }
  );
}

/** Notifications in-app de l'utilisateur (GET /api/v1/notifications). */
export function useMyNotifications() {
  const driverId = useDriverId();
  const query = useApiQuery<NotificationPage>(`driver:notifications:${driverId}`, () => fetchMyNotifications(0, 50), [driverId], {
    enabled: Boolean(driverId),
  });
  // Liste (et cloche de l'accueil) à jour : toutes les 45 s, au retour au premier plan, après une lecture.
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  useNotificationRefresh(refresh, Boolean(driverId));
  return query;
}

/** Une notification est lue si le serveur l'indique (isRead, ou read selon la sérialisation). */
export function isNotificationRead(n: AppNotification) {
  return Boolean(n.isRead ?? n.read);
}
