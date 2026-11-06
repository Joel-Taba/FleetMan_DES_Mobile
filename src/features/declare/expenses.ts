// Dépenses déclarées par le chauffeur (péage, amende, autre), lues par GET /api/v1/budget/expenses/mine.
// Repli pour un serveur plus ancien sans cette route : identifiants retenus sur ce téléphone et ceux
// portés par ses notifications (EXPENSE_APPROVED / EXPENSE_REJECTED), relus un par un.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError, apiFetch } from "@/api/client";
import { fetchExpense } from "@/api/driver";
import type { ExpenseResponse, ManualExpenseType, NotificationPage } from "@/api/types";
import type { BadgeTone } from "@/components/ui/Badge";
import { tr } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { notificationData, notificationEvent, type ServerNotification } from "@/features/notifications/api";
import { EXPENSE_STATUS_LABEL } from "./api";

export const MANUAL_EXPENSE_TYPES: ManualExpenseType[] = ["TOLL", "FINE", "OTHER"];

export const EXPENSE_TYPE_LABEL: Record<ManualExpenseType, string> = {
  TOLL: "Péage",
  FINE: "Amende",
  OTHER: "Autre",
};

const LIMIT = 20;
const keyOf = (userId: string) => `fm:my-expenses:${userId}`;

export async function readExpenseIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyOf(userId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function writeExpenseIds(userId: string, ids: string[]) {
  await AsyncStorage.setItem(keyOf(userId), JSON.stringify(ids.slice(0, LIMIT))).catch(() => undefined);
}

/** Retient une dépense créée depuis ce téléphone (suivi dans « Mes déclarations récentes »). */
export async function rememberExpense(userId: string, id: string) {
  if (!userId || !id) return;
  const ids = await readExpenseIds(userId);
  await writeExpenseIds(userId, [id, ...ids.filter((x) => x !== id)]);
}

/** Dépenses manuelles citées par les notifications du chauffeur (pas celles d'un plein ou d'une maintenance). */
export function expenseIdsFromNotifications(page: NotificationPage | undefined): string[] {
  const ids: string[] = [];
  for (const n of page?.content ?? []) {
    const d = notificationData(n as ServerNotification);
    if (!notificationEvent(n as ServerNotification).startsWith("EXPENSE_")) continue;
    if (!d.expenseId || d.fuelRechargeId || d.maintenanceId) continue;
    if (!ids.includes(d.expenseId)) ids.push(d.expenseId);
  }
  return ids;
}

/** Relit chaque dépense ; une dépense supprimée (404) est oubliée. Erreur réseau : on garde le cache. */
export async function fetchMyExpenses(userId: string, notifiedIds: string[]): Promise<ExpenseResponse[]> {
  try {
    const mine = await apiFetch<ExpenseResponse[]>("/api/v1/budget/expenses/mine");
    return (mine ?? [])
      .filter((e) => e.sourceType === "MANUAL" && (MANUAL_EXPENSE_TYPES as string[]).includes(e.expenseType))
      .sort((a, b) => String(b.expenseDate ?? b.createdAt).localeCompare(String(a.expenseDate ?? a.createdAt)))
      .slice(0, LIMIT);
  } catch (err) {
    // Route absente (ancien serveur) : repli sur les identifiants connus ; hors ligne : on remonte l'erreur.
    if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 405)) throw err;
  }
  const local = await readExpenseIds(userId);
  const ids = [...local, ...notifiedIds.filter((id) => !local.includes(id))].slice(0, LIMIT);
  if (ids.length === 0) return [];
  const results = await Promise.allSettled(ids.map((id) => fetchExpense(id)));
  const gone = ids.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && r.reason instanceof ApiError && (r.reason.status === 404 || r.reason.status === 403);
  });
  if (gone.length > 0) await writeExpenseIds(userId, local.filter((id) => !gone.includes(id)));
  const offline = results.some((r) => r.status === "rejected" && r.reason instanceof ApiError && r.reason.status === 0);
  if (offline) throw new ApiError(tr("Connexion au serveur impossible."), 0);
  return results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
    .filter((e) => e.sourceType === "MANUAL" && (MANUAL_EXPENSE_TYPES as string[]).includes(e.expenseType));
}

export function expenseTone(status: string): BadgeTone {
  return status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "warning";
}

export function expenseTypeLabel(type: string): string {
  return tr(EXPENSE_TYPE_LABEL[type as ManualExpenseType] ?? type);
}

/** Ligne « Mes déclarations récentes » : type, montant, statut et motif éventuel du gestionnaire. */
export function expenseDetails(e: ExpenseResponse): string[] {
  const details: string[] = [];
  if (e.description) details.push(e.description);
  if (e.status === "REJECTED" && e.rejectionReason) details.push(`${tr("Motif")} : ${e.rejectionReason}`);
  if (e.status === "PENDING" && e.approvalLevel === "ADMIN") details.push(tr("Validation par l'administrateur"));
  if (e.status === "PENDING" && !e.receiptUrl) details.push(tr("Sans justificatif : la dépense ne pourra pas être validée."));
  return details;
}

export function expenseTitle(e: ExpenseResponse): string {
  return `${expenseTypeLabel(e.expenseType)} · ${Number(e.amount).toLocaleString()} XAF`;
}

export function expenseSubtitle(e: ExpenseResponse): string {
  return [e.vehicleRegistration, formatDateTime(e.expenseDate)].filter(Boolean).join(" · ");
}

export function expenseStatusLabel(status: string): string {
  return tr(EXPENSE_STATUS_LABEL[status] ?? status);
}
