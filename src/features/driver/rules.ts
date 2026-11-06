// Règles métier du chauffeur, portées du web (lib/trips/stops.ts, DriverAssignments, mappers).
import type { ApiTrip, AssignmentResponse, TripDetailLine, TripStop } from "@/api/types";
import { tr } from "@/i18n";

export const STOP_FAILURE_REASONS = ["REFUSED", "ABSENT", "CLOSED", "ADDRESS_NOT_FOUND", "DAMAGED", "NO_TIME", "OTHER"] as const;
export const SHORTAGE_REASONS = ["REFUSED", "DAMAGED", "MISSING", "OTHER"] as const;

export function isStopClosed(stop: Pick<TripStop, "status">) {
  return stop.status === "COMPLETED" || stop.status === "FAILED" || stop.status === "SKIPPED";
}

/** Arrêts clos / total. */
export function stopProgress(trip: Pick<ApiTrip, "stops">) {
  const stops = trip.stops ?? [];
  return { done: stops.filter(isStopClosed).length, total: stops.length };
}

/** Prochain arrêt à servir : celui où le chauffeur est sur place, sinon le premier en attente. */
export function nextStop(stops: TripStop[]) {
  return stops.find((s) => s.status === "ARRIVED") ?? stops.find((s) => s.status === "PENDING") ?? null;
}

/** Heure locale sans fuseau (format attendu par le serveur). */
export function localIsoNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

export type Tone = "default" | "success" | "warning" | "danger" | "muted";

export function stopTone(status: TripStop["status"]): Tone {
  if (status === "COMPLETED") return "success";
  if (status === "ARRIVED") return "default";
  if (status === "FAILED") return "danger";
  if (status === "SKIPPED") return "muted";
  return "warning";
}

/** Quantité attendue d'une ligne à l'arrêt : chargée au départ, plafonnée au prévu. */
export function expectedQty(line: TripDetailLine) {
  return Math.min(line.departureQuantity ?? line.quantity ?? 0, line.quantity ?? line.departureQuantity ?? 0);
}

export function tripStatusLabel(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: "Créé",
    DEPARTED: "En cours",
    ARRIVED: "Livraisons terminées",
    MISSED: "Manqué",
    ONGOING: "En cours",
    COMPLETED: "Terminé",
    CANCELLED: "Annulé",
  };
  return tr(map[status] ?? status);
}

export function tripStatusTone(status: string): Tone {
  switch (status) {
    case "DEPARTED":
    case "ARRIVED":
    case "ONGOING":
      return "warning";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
    case "MISSED":
      return "danger";
    default:
      return "muted";
  }
}

/** Distance d'un trajet : saisie, sinon calculée depuis les index kilométriques. */
export function tripDistance(trip: ApiTrip): number | null {
  if (trip.distanceKm != null) return trip.distanceKm;
  if (trip.computedDistanceKm != null) return trip.computedDistanceKm;
  if (trip.returnKmIndex != null && trip.departureKmIndex != null) return trip.returnKmIndex - trip.departureKmIndex;
  return null;
}

/** Destination affichable d'un trajet : destination, sinon dernier arrêt. */
export function tripDestination(trip: ApiTrip): string | null {
  if (trip.destinationLocation) return trip.destinationLocation;
  const stops = trip.stops ?? [];
  return stops.length ? stops[stops.length - 1].location : null;
}

// ── Postes ──────────────────────────────────────────────────────────────────

export const ASSIGNMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  IN_PROGRESS: { label: "En cours", tone: "default" },
  PLANNED: { label: "À venir", tone: "muted" },
  PENDING: { label: "À venir", tone: "muted" },
  COMPLETED: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

/** Poste à venir dont le chauffeur n'a pas encore accusé réception (création ou modification). */
export function needsAck(a: AssignmentResponse): boolean {
  return (a.status === "PENDING" || a.status === "IN_PROGRESS") && !a.acknowledgedAt;
}

/** Poste de nuit : il finit un autre jour que celui où il commence. */
export function isNightShift(a: AssignmentResponse): boolean {
  return a.endDatetime.slice(0, 10) !== a.startDatetime.slice(0, 10);
}

/** Heure "HH:mm" d'une date-heure ISO locale (sans conversion de fuseau). */
export function hhmm(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = iso.includes("T") ? iso.split("T")[1] : iso;
  return t.slice(0, 5);
}

/** Durée lisible en minutes → "2 h 05". */
export function durationLabel(minutes: number | null | undefined) {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function localDay(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
