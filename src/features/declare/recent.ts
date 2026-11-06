// Déclarations récentes du chauffeur (pleins, maintenances) lues sur le serveur, avec la réponse
// du gestionnaire : validation ou rejet du plein, planification / atelier / clôture de la
// maintenance, validation ou rejet des dépenses (péage, amende, autre). Le cache local
// (pushRecent) ne sert plus qu'hors réseau, en secours.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BadgeTone } from "@/components/ui/Badge";
import type { ExpenseResponse } from "@/api/types";
import { useApiQuery } from "@/hooks/useApiQuery";
import { tr } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { useNotificationRefresh } from "@/features/notifications/store";
import { useMyNotifications } from "@/features/driver/hooks";
import {
  EXPENSE_STATUS_LABEL,
  MAINTENANCE_STATUS_LABEL,
  fetchMyFuelRecharges,
  fetchMyMaintenances,
  type FuelRechargeDetail,
  type MaintenanceDetail,
} from "./api";
import {
  expenseDetails,
  expenseIdsFromNotifications,
  expenseStatusLabel,
  expenseSubtitle,
  expenseTitle,
  expenseTone,
  fetchMyExpenses,
} from "./expenses";

export type RecentDeclaration = {
  id: string;
  kind: "incident" | "fuel" | "maintenance" | "expense";
  label: string;
  status: string;
  at: string;
};

/** Ligne affichée : statut lisible, teinte et précisions apportées par le gestionnaire. */
export type DeclarationItem = {
  key: string;
  kind: "fuel" | "maintenance" | "expense";
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: BadgeTone;
  details: string[];
  at: string;
};

const LIMIT = 5;
const keyOf = (userId: string) => `fm:recent-declarations:${userId}`;

export async function readRecent(userId: string): Promise<RecentDeclaration[]> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(userId));
    return raw ? (JSON.parse(raw) as RecentDeclaration[]) : [];
  } catch {
    return [];
  }
}

export async function pushRecent(userId: string, item: RecentDeclaration) {
  if (!userId) return;
  const list = await readRecent(userId);
  const next = [item, ...list.filter((x) => !(x.kind === item.kind && x.id === item.id))].slice(0, LIMIT);
  await AsyncStorage.setItem(keyOf(userId), JSON.stringify(next)).catch(() => undefined);
}

const MAINTENANCE_TONE: Record<string, BadgeTone> = {
  REQUESTED: "warning",
  PLANNED: "default",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  CANCELLED: "muted",
};

export function fuelItem(f: FuelRechargeDetail): DeclarationItem {
  const status = f.expenseStatus ?? "APPROVED";
  const details: string[] = [];
  if (f.stationLabel || f.stationName) details.push(`${tr("Station")} : ${f.stationLabel ?? codeLabel(f.stationName)}`);
  if (f.odometerKm != null) details.push(`${tr("Kilométrage")} : ${Number(f.odometerKm).toLocaleString()} km`);
  if (status === "REJECTED" && f.expenseRejectionReason) details.push(`${tr("Motif")} : ${f.expenseRejectionReason}`);
  if (status === "PENDING" && f.expenseApprovalLevel === "ADMIN") details.push(tr("Validation par l'administrateur"));
  return {
    key: `fuel-${f.id}`,
    kind: "fuel",
    title: `${tr("Plein")} · ${f.quantity} L · ${Number(f.price).toLocaleString()} XAF`,
    subtitle: [f.vehicleRegistration, formatDateTime(f.rechargeDateTime)].filter(Boolean).join(" · "),
    statusLabel: tr(EXPENSE_STATUS_LABEL[status] ?? status),
    tone: status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "warning",
    details,
    at: f.rechargeDateTime ?? "",
  };
}

export function maintenanceItem(m: MaintenanceDetail): DeclarationItem {
  const status = m.status ?? "COMPLETED";
  const details: string[] = [];
  if (m.maintenanceType) details.push(`${tr("Type")} : ${codeLabel(m.maintenanceType)}${m.urgent ? ` · ${tr("Urgent")}` : ""}`);
  if (m.plannedAt && (status === "PLANNED" || status === "IN_PROGRESS")) details.push(`${tr("Prévue le")} ${formatDateTime(m.plannedAt)}`);
  if (m.garage) details.push(`${tr("Garage")} : ${m.garage}`);
  if (status === "IN_PROGRESS") details.push(tr("Véhicule à l'atelier : indisponible jusqu'à la fin de l'intervention."));
  if (status === "COMPLETED" && m.completedAt) details.push(`${tr("Terminée le")} ${formatDateTime(m.completedAt)}`);
  if (status === "CANCELLED" && m.cancelReason) details.push(`${tr("Motif")} : ${m.cancelReason}`);
  return {
    key: `maintenance-${m.id}`,
    kind: "maintenance",
    title: codeLabel(m.subject),
    subtitle: [m.vehicleRegistration, formatDateTime(m.dateTime)].filter(Boolean).join(" · "),
    statusLabel: tr(MAINTENANCE_STATUS_LABEL[status] ?? status),
    tone: MAINTENANCE_TONE[status] ?? "muted",
    details,
    at: m.dateTime ?? "",
  };
}

export function expenseItem(e: ExpenseResponse): DeclarationItem {
  return {
    key: `expense-${e.id}`,
    kind: "expense",
    title: expenseTitle(e),
    subtitle: expenseSubtitle(e),
    statusLabel: expenseStatusLabel(e.status),
    tone: expenseTone(e.status),
    details: expenseDetails(e),
    at: e.expenseDate ?? e.createdAt ?? "",
  };
}

/**
 * Pleins, maintenances et dépenses du chauffeur depuis le serveur (statuts réels), rafraîchis au retour
 * au premier plan et à chaque notification lue ; repli sur le cache local hors réseau.
 */
export function useDeclarationHistory(userId: string) {
  const enabled = Boolean(userId);
  const fuel = useApiQuery<FuelRechargeDetail[]>(`driver:fuel:${userId}`, fetchMyFuelRecharges, [userId], { enabled });
  const maintenances = useApiQuery<MaintenanceDetail[]>(`driver:maintenances:${userId}`, fetchMyMaintenances, [userId], { enabled });
  // Dépenses : identifiants retenus sur ce téléphone + ceux cités par les notifications.
  const notifications = useMyNotifications();
  const notifiedIds = useMemo(() => expenseIdsFromNotifications(notifications.data), [notifications.data]);
  const expenses = useApiQuery<ExpenseResponse[]>(
    `driver:expenses:${userId}`,
    () => fetchMyExpenses(userId, notifiedIds),
    [userId, notifiedIds.join(",")],
    { enabled }
  );
  const [local, setLocal] = useState<RecentDeclaration[]>([]);

  const reloadLocal = useCallback(async () => {
    if (userId) setLocal(await readRecent(userId));
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    readRecent(userId).then((list) => {
      if (!cancelled) setLocal(list);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refetchFuel = fuel.refetch;
  const refetchMaintenances = maintenances.refetch;
  const refetchExpenses = expenses.refetch;
  const reload = useCallback(async () => {
    await Promise.all([refetchFuel(), refetchMaintenances(), refetchExpenses(), reloadLocal()]);
  }, [refetchFuel, refetchMaintenances, refetchExpenses, reloadLocal]);
  const refresh = useCallback(() => void reload(), [reload]);
  useNotificationRefresh(refresh, enabled);

  const items = useMemo(
    () =>
      [
        ...(fuel.data ?? []).map(fuelItem),
        ...(maintenances.data ?? []).map(maintenanceItem),
        ...(expenses.data ?? []).map(expenseItem),
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 15),
    [fuel.data, maintenances.data, expenses.data]
  );

  return {
    items,
    /** Le serveur a répondu au moins une fois (sinon on montre le cache local). */
    fromServer: fuel.data !== undefined || maintenances.data !== undefined || expenses.data !== undefined,
    local: local.filter((x) => x.kind !== "incident"),
    loading: fuel.loading || maintenances.loading || expenses.loading,
    refreshing: fuel.refreshing || maintenances.refreshing || expenses.refreshing,
    reload,
  };
}
