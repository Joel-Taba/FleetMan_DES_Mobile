// Pleins et maintenances du chauffeur, avec la réponse du gestionnaire (mêmes chemins que le web,
// lib/operations/api.ts).
import { apiFetch, type MaybeQueued } from "@/api/client";
import type { FuelRechargeResponse, MaintenanceResponse } from "@/api/types";

export type FuelRechargeDetail = FuelRechargeResponse & {
  stationLabel?: string | null;
  odometerKm?: number | null;
  receiptUrl?: string | null;
  expenseId?: string | null;
  expenseStatus?: string | null;
  expenseRejectionReason?: string | null;
  expenseApprovalLevel?: string | null;
};

export type MaintenanceDetail = MaintenanceResponse & {
  status?: string | null;
  maintenanceType?: string | null;
  urgent?: boolean;
  garage?: string | null;
  plannedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelReason?: string | null;
};

export function fetchMyFuelRecharges() {
  return apiFetch<FuelRechargeDetail[]>("/api/v1/operations/fuel-recharges/mine");
}

export function fetchMyMaintenances() {
  return apiFetch<MaintenanceDetail[]>("/api/v1/operations/maintenances/mine");
}

/** Plein déclaré par le chauffeur : relevé, position et ticket vont au gestionnaire. */
export function declareFuel(body: {
  quantity: number;
  price: number;
  vehicleId: string;
  stationName?: string;
  odometerKm?: number;
  latitude?: number;
  longitude?: number;
  receiptUrl?: string;
  receiptName?: string;
  receiptMime?: string;
}) {
  return apiFetch<MaybeQueued<FuelRechargeDetail>>("/api/v1/operations/fuel-recharges", { method: "POST", body });
}

/** Demande de maintenance : le gestionnaire la planifie, la démarre, la clôt ou l'annule. */
export function requestMaintenance(body: {
  subject: string;
  report?: string;
  vehicleId: string;
  maintenanceType?: string;
  urgent?: boolean;
  latitude?: number;
  longitude?: number;
}) {
  return apiFetch<MaybeQueued<MaintenanceDetail>>("/api/v1/operations/maintenances", { method: "POST", body });
}

export const MAINTENANCE_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Demandée",
  PLANNED: "Planifiée",
  IN_PROGRESS: "À l'atelier",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

export const EXPENSE_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente de validation",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};
