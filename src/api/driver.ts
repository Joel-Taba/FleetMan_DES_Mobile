// Appels API de la vue chauffeur. Chemins identiques au front web
// (lib/api/driver.ts, lib/api/manager.ts, lib/offline/mutations/*).
import { Platform } from "react-native";
import { ApiError, apiFetch, apiUpload, type MaybeQueued, type Page } from "@/api/client";
import type {
  IncidentCaseThread,
  ApiDriver,
  ApiTrip,
  ApiVehicle,
  AssignmentResponse,
  CreateIncidentInput,
  DocumentChecklistItem,
  DocumentResponse,
  DriverDocumentInput,
  FuelRechargeResponse,
  IncidentCase,
  IncidentResponse,
  MaintenanceResponse,
  MissionSubmission,
  NotificationPage,
  SubmissionBody,
  TripStop,
  UploadFileResponse,
} from "@/api/types";

// ── Profil, véhicule ────────────────────────────────────────────────────────

export function fetchMyDriverProfile(driverId: string) {
  return apiFetch<ApiDriver>(`/api/v1/drivers/${driverId}`);
}

export function fetchAssignedVehicle(vehicleId: string) {
  return apiFetch<ApiVehicle>(`/api/v1/vehicles/${vehicleId}`);
}

export function updateVehicleOperational(vehicleId: string, updates: Record<string, unknown>) {
  return apiFetch<MaybeQueued<void>>(`/api/v1/vehicles/${vehicleId}/operational`, { method: "PATCH", body: updates });
}

export type MyVehicleReason = "REGULAR" | "TRIP" | "SHIFT";

/** Véhicule auquel le chauffeur est affecté (attitré, trajet en cours, poste du jour). */
export type MyVehicle = {
  vehicleId: string;
  licensePlate: string;
  label: string | null;
  reasons: MyVehicleReason[];
};

function vehicleLabel(v: ApiVehicle | null) {
  return v ? [v.brand, v.model].filter(Boolean).join(" ") || null : null;
}

/**
 * Véhicules du chauffeur. `GET /drivers/me/vehicles` ; si le serveur ne l'expose pas encore
 * (404/405/501), repli sur le véhicule attitré du profil et celui du trajet en cours.
 */
export async function fetchMyVehicles(driverId: string): Promise<MyVehicle[]> {
  try {
    return (await apiFetch<MyVehicle[]>("/api/v1/drivers/me/vehicles")) ?? [];
  } catch (err) {
    if (!(err instanceof ApiError) || ![404, 405, 501].includes(err.status)) throw err;
  }
  const [profile, trip] = await Promise.all([fetchMyDriverProfile(driverId), fetchMyActiveTrip().catch(() => null)]);
  const reasons = new Map<string, MyVehicleReason[]>();
  if (profile.assignedVehicleId) reasons.set(profile.assignedVehicleId, ["REGULAR"]);
  if (trip?.vehicleId) reasons.set(trip.vehicleId, [...(reasons.get(trip.vehicleId) ?? []), "TRIP"]);
  return Promise.all(
    [...reasons.entries()].map(async ([vehicleId, r]) => {
      const v = await fetchAssignedVehicle(vehicleId).catch(() => null);
      return {
        vehicleId,
        licensePlate: v?.licensePlate ?? (r.includes("REGULAR") ? profile.assignedVehicleLabel ?? "" : ""),
        label: vehicleLabel(v),
        reasons: r,
      };
    })
  );
}

// ── Trajets ─────────────────────────────────────────────────────────────────

export async function fetchMyActiveTrip(): Promise<ApiTrip | null> {
  try {
    const trip = await apiFetch<ApiTrip | null>("/api/v1/trips/my-active");
    return trip ?? null;
  } catch (err) {
    // Comme le web : pas de trajet actif = null ; une coupure réseau remonte pour le cache.
    if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
      const status = (err as { status: number }).status;
      if (status === 404 || status === 204) return null;
      if (status > 0 && status < 500) return null;
    }
    throw err;
  }
}

export async function fetchMyTripHistory(): Promise<ApiTrip[]> {
  const data = await apiFetch<ApiTrip[] | Page<ApiTrip>>("/api/v1/trips/my-history");
  if (Array.isArray(data)) return data;
  return data?.content ?? [];
}

export function fetchTripSubmissions(tripId: string) {
  return apiFetch<MissionSubmission[]>(`/api/v1/trips/${tripId}/submissions`);
}

/** Chauffeur : chargement ajouté (ADD) ou retiré / refusé (REMOVE) en route. */
export function submitTripComplement(tripId: string, body: SubmissionBody) {
  return apiFetch<MaybeQueued<string>>(`/api/v1/trips/${tripId}/submissions`, { method: "POST", body });
}

export type StopAction = "arrive" | "complete" | "fail";

/** Action du chauffeur sur un arrêt : arrivée, livraison (quantités, réceptionnaire, preuve), échec motivé. */
export function stopAction(tripId: string, stopId: string, action: StopAction, body: Record<string, unknown>) {
  return apiFetch<MaybeQueued<TripStop>>(`/api/v1/trips/${tripId}/stops/${stopId}/${action}`, { method: "POST", body });
}

// ── Postes (affectations) ───────────────────────────────────────────────────

export async function fetchMyAssignmentsToday(driverId: string, page = 0, size = 20) {
  const data = await apiFetch<Page<AssignmentResponse>>(
    `/api/v1/assignments/driver/${driverId}/today?page=${page}&size=${size}`
  );
  return data?.content ?? [];
}

export async function fetchMyAssignments(driverId: string, page = 0, size = 50) {
  const data = await apiFetch<Page<AssignmentResponse>>(
    `/api/v1/assignments/driver/${driverId}?page=${page}&size=${size}`
  );
  return data?.content ?? [];
}

export function acknowledgeAssignment(id: string) {
  return apiFetch<MaybeQueued<AssignmentResponse>>(`/api/v1/assignments/${id}/acknowledge`, { method: "POST" });
}

// ── Déclarations terrain ────────────────────────────────────────────────────

export function createIncident(body: CreateIncidentInput) {
  return apiFetch<MaybeQueued<IncidentResponse>>("/api/v1/operations/incidents", { method: "POST", body });
}

export function createFuelRecharge(body: {
  quantity: number;
  price: number;
  vehicleId: string;
  driverId?: string;
  stationName?: string;
  longitude?: number;
  latitude?: number;
}) {
  return apiFetch<MaybeQueued<FuelRechargeResponse>>("/api/v1/operations/fuel-recharges", { method: "POST", body });
}

export function createMaintenance(body: {
  subject: string;
  report?: string;
  vehicleId: string;
  driverId?: string;
  longitude?: number;
  latitude?: number;
  locationName?: string;
}) {
  return apiFetch<MaybeQueued<MaintenanceResponse>>("/api/v1/operations/maintenances", { method: "POST", body });
}

const INCIDENTS = "/api/v1/operations/incidents";

export function fetchMyIncidents() {
  return apiFetch<IncidentResponse[]>(`${INCIDENTS}/mine`);
}

export function fetchIncidentCase(id: string) {
  return apiFetch<IncidentCase>(`${INCIDENTS}/${id}/case`);
}

export function addIncidentAttachment(
  id: string,
  body: { kind: string; fileUrl: string; fileName?: string; mimeType?: string; sizeBytes?: number }
) {
  return apiFetch<IncidentCase>(`${INCIDENTS}/${id}/attachments`, { method: "POST", body });
}

// ── Notifications in-app ────────────────────────────────────────────────────

export function fetchMyNotifications(page = 0, size = 50) {
  return apiFetch<NotificationPage>(`/api/v1/notifications?page=${page}&size=${size}`);
}

export function markNotificationRead(id: string) {
  return apiFetch<unknown>(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>("/api/v1/notifications/read-all", { method: "PATCH" });
}

// ── Dossier documentaire ────────────────────────────────────────────────────

export type DocumentTargetKind = "vehicle" | "driver";

function documentsPath(kind: DocumentTargetKind, targetId: string) {
  return `/api/v1/${kind}s/${targetId}/documents`;
}

export function fetchTargetDocuments(kind: DocumentTargetKind, targetId: string) {
  return apiFetch<Page<DocumentResponse>>(`${documentsPath(kind, targetId)}?page=0&size=100`);
}

export function fetchDocumentChecklist(kind: DocumentTargetKind, targetId: string) {
  return apiFetch<DocumentChecklistItem[]>(`${documentsPath(kind, targetId)}/checklist`);
}

export function fetchDocumentHistory(kind: DocumentTargetKind, targetId: string) {
  return apiFetch<DocumentResponse[]>(`${documentsPath(kind, targetId)}/history`);
}

export function createDriverDocument(driverId: string, body: DriverDocumentInput) {
  return apiFetch<DocumentResponse>(`/api/v1/drivers/${driverId}/documents`, {
    method: "POST",
    body: { ...body, driverId },
  });
}

/** Retrait d'un dépôt encore en attente de contrôle (le web : « Retirer »). */
export function archiveDocument(id: string, reason?: string) {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return apiFetch<void>(`/api/v1/documents/${id}${query}`, { method: "DELETE" });
}

// ── Fichiers ────────────────────────────────────────────────────────────────

/** Fichier choisi via expo-image-picker (ou équivalent). Sur le web, `file` porte le File natif. */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  file?: Blob | null;
};

/** POST /api/v1/files/upload?category=… : renvoie l'URL protégée du fichier. */
export async function uploadFile(picked: PickedFile, category = "document") {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = picked.file ?? (await (await fetch(picked.uri)).blob());
    form.append("file", blob as Blob, picked.name);
  } else {
    // React Native accepte { uri, name, type } dans un FormData multipart.
    form.append("file", { uri: picked.uri, name: picked.name, type: picked.mimeType } as unknown as Blob);
  }
  return apiUpload<UploadFileResponse>(`/api/v1/files/upload?category=${encodeURIComponent(category)}`, form);
}

// ── Dossier d'incident : échanges avec le gestionnaire (domaine incidents) ──

/** Message ou réponse du chauffeur sur son dossier ; le gestionnaire est notifié. */
export function commentIncident(id: string, message: string) {
  return apiFetch<MaybeQueued<IncidentCaseThread>>(`/api/v1/operations/incidents/${id}/comments`, { method: "POST", body: { message } });
}

export function fetchIncidentThread(id: string) {
  return apiFetch<IncidentCaseThread>(`/api/v1/operations/incidents/${id}/case`);
}

// ── Effectifs : absences, demandes d'absence, relevés terrain (domaine workforce) ──

export function fetchMyAbsences(driverId: string) {
  return apiFetch<import("@/api/types").DriverAbsence[]>(`/api/v1/drivers/${driverId}/absences`);
}

export function fetchMyAbsenceRequests(driverId: string) {
  return apiFetch<import("@/api/types").AbsenceRequest[]>(`/api/v1/drivers/${driverId}/absence-requests`);
}

/** Demander un congé ou signaler un arrêt maladie (le gestionnaire est notifié). */
export function createAbsenceRequest(
  driverId: string,
  body: { type: string; startDate: string; endDate: string; reason?: string | null }
) {
  return apiFetch<import("@/api/types").AbsenceRequest>(`/api/v1/drivers/${driverId}/absence-requests`, {
    method: "POST",
    body,
  });
}

export function withdrawAbsenceRequest(driverId: string, requestId: string) {
  return apiFetch<import("@/api/types").AbsenceRequest>(
    `/api/v1/drivers/${driverId}/absence-requests/${requestId}/withdraw`,
    { method: "POST" }
  );
}

export function fetchVehicleOperationalUpdates(vehicleId: string, limit = 5) {
  return apiFetch<import("@/api/types").VehicleOperationalUpdate[]>(
    `/api/v1/vehicles/${vehicleId}/operational/updates?limit=${limit}`
  );
}

// ── Messagerie chauffeur ↔ gestionnaire (domaine messages) ──────────────────

/** Fil du chauffeur avec son gestionnaire, du plus ancien au plus récent (marque les messages reçus comme lus). */
export function fetchMyMessages() {
  return apiFetch<import("@/api/types").DriverMessage[]>(`/api/v1/messages/mine`);
}

/** Message au gestionnaire (2000 caractères maximum, non vide). */
export function sendMyMessage(body: string) {
  return apiFetch<MaybeQueued<import("@/api/types").DriverMessage>>(`/api/v1/messages/mine`, { method: "POST", body: { body } });
}

export function fetchMyUnreadMessageCount() {
  return apiFetch<import("@/api/types").MessageUnreadCount>(`/api/v1/messages/mine/unread-count`);
}

// ── Dépenses du chauffeur : péage, amende, autre (domaine budget) ───────────

/** Dépense déclarée par le chauffeur : en attente, le gestionnaire est notifié (EXPENSE_SUBMITTED). */
export function createExpense(body: import("@/api/types").CreateExpenseInput) {
  return apiFetch<import("@/api/types").ExpenseResponse>("/api/v1/budget/expenses", { method: "POST", body });
}

/** Détail (statut, motif de rejet) d'une dépense dont le chauffeur est l'auteur ou le concerné. */
export function fetchExpense(id: string) {
  return apiFetch<import("@/api/types").ExpenseResponse>(`/api/v1/budget/expenses/${id}`);
}

/** Justificatif ajouté après coup (dépense encore en attente). */
export function attachExpenseReceipt(id: string, body: { fileUrl: string; fileName?: string; mimeType?: string }) {
  return apiFetch<import("@/api/types").ExpenseResponse>(`/api/v1/budget/expenses/${id}/receipt`, { method: "PUT", body });
}

// ── Suivi GPS en direct ─────────────────────────────────────────────────────

/**
 * Position du chauffeur pendant SON trajet en cours. Jamais mise en file hors ligne (hors de la
 * liste des actions différées) : sans réseau, le point est simplement perdu.
 */
export function sendTripTelemetry(tripId: string, body: import("@/api/types").TelemetryInput) {
  return apiFetch<import("@/api/types").TelemetryAck>(`/api/v1/trips/${tripId}/telemetry`, { method: "POST", body });
}
