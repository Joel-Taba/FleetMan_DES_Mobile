// React side of the offline queue: the driver's pending and refused actions, labels.
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useAuth } from "@/auth/AuthContext";
import { tr } from "@/i18n/core";

import { getQueueSnapshot, hydrateQueue, subscribeQueue } from "./queue";
import { failedOf, normalizePath, pendingOf, type OfflineKind, type QueueItem } from "./rules";

export type OfflineQueueView = {
  pending: QueueItem[];
  failed: QueueItem[];
  syncing: boolean;
  inFlightId: string | null;
};

/** Pending and refused actions of the logged-in driver (live). */
export function useOfflineQueue(): OfflineQueueView {
  const snap = useSyncExternalStore(subscribeQueue, getQueueSnapshot, getQueueSnapshot);
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    void hydrateQueue();
  }, []);
  return useMemo(
    () => ({
      pending: pendingOf(snap.items, userId),
      failed: failedOf(snap.items, userId),
      syncing: snap.syncing,
      inFlightId: snap.inFlightId,
    }),
    [snap, userId]
  );
}

/** Pending actions whose path matches (e.g. the queued messages of the thread). */
export function usePendingActions(kind: OfflineKind, path?: string): QueueItem[] {
  const { pending } = useOfflineQueue();
  return useMemo(
    () => pending.filter((i) => i.kind === kind && (!path || normalizePath(i.path) === normalizePath(path))),
    [pending, kind, path]
  );
}

export const OFFLINE_KIND_LABEL: Record<OfflineKind, string> = {
  fuel: "Déclaration de plein",
  maintenance: "Demande de maintenance",
  incident: "Signalement d'incident",
  incidentComment: "Message sur un incident",
  stopArrive: "Arrivée à un arrêt",
  stopComplete: "Arrêt servi",
  stopFail: "Arrêt en échec",
  submission: "Changement de chargement",
  acknowledge: "Confirmation de poste",
  vehicleOperational: "Relevé du véhicule",
  message: "Message au gestionnaire",
  expense: "Dépense",
};

/** Short reminder of what the action carries (message text, litres, subject…). */
export function describeItem(item: QueueItem): string {
  const b = (item.body ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
  let detail = "";
  switch (item.kind) {
    case "message":
    case "incidentComment":
      detail = text(b.body) || text(b.message);
      break;
    case "fuel":
      detail = [b.quantity != null ? `${text(b.quantity)} L` : "", text(b.stationName)].filter(Boolean).join(" · ");
      break;
    case "maintenance":
      detail = text(b.subject);
      break;
    case "incident":
      detail = text(b.description) || text(b.type);
      break;
    case "vehicleOperational":
      detail = [b.odometerReading != null ? `${text(b.odometerReading)} km` : "", text(b.fuelLevel)].filter(Boolean).join(" · ");
      break;
    case "expense":
      detail = [text(b.amount) ? `${text(b.amount)} XAF` : "", text(b.description) || text(b.label)].filter(Boolean).join(" · ");
      break;
    default:
      detail = "";
  }
  return detail.length > 90 ? `${detail.slice(0, 89)}…` : detail;
}

/** Message shown by a screen when its action was saved for later. */
export function queuedMessage(): string {
  return tr("Enregistré hors ligne : envoi automatique au retour du réseau.");
}
