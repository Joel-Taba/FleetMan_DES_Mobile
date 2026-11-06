// Centre de notifications du chauffeur : compteur de non lues et lecture du contrat `data`.
import { apiFetch } from "@/api/client";
import type { AppNotification } from "@/api/types";

/** GET /api/v1/notifications/unread-count : badge de la cloche et de la barre d'onglets. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = await apiFetch<{ count?: number }>("/api/v1/notifications/unread-count");
  return Number(res?.count ?? 0);
}

/** Notification telle que renvoyée par le serveur (champs ajoutés au format historique). */
export type ServerNotification = AppNotification & {
  event?: string | null;
  data?: Record<string, unknown> | null;
};

/** Références de la notification : { type, incidentId, tripId, maintenanceId… } (contrat AppNotifier). */
export function notificationData(n: ServerNotification): Record<string, string> {
  let source: Record<string, unknown> | null = n.data && typeof n.data === "object" ? n.data : null;
  if (!source && n.dataJson) {
    try {
      const parsed: unknown = JSON.parse(n.dataJson);
      source = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      source = null;
    }
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source ?? {})) if (v != null) out[k] = String(v);
  return out;
}

export function notificationEvent(n: ServerNotification): string {
  return (n.event ?? notificationData(n).type ?? "").toUpperCase();
}
