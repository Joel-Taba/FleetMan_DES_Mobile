import type { ApiTrip } from "@/api/types";

/** Clé de tri chronologique d'un trajet (date + heure de départ). */
export function tripStartKey(trip: Pick<ApiTrip, "startDate" | "startTime">) {
  return `${trip.startDate ?? ""}T${trip.startTime ?? ""}`;
}

/** Trajets planifiés (pas encore partis), du plus proche au plus lointain. */
export function upcomingTrips(list: ApiTrip[]) {
  return list.filter((x) => x.status === "SCHEDULED").sort((a, b) => tripStartKey(a).localeCompare(tripStartKey(b)));
}

/** Trajets passés ou clos, du plus récent au plus ancien (hors trajet actif). */
export function pastTrips(list: ApiTrip[], activeId?: string | null) {
  return list
    .filter((x) => x.status !== "SCHEDULED" && x.id !== activeId)
    .sort((a, b) => tripStartKey(b).localeCompare(tripStartKey(a)));
}
