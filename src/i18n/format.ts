import { appLocale } from "./core";

function toDate(iso: string | number | Date | null | undefined): Date | null {
  if (iso == null || iso === "") return null;
  const date = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(iso: string | number | Date | null | undefined, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(iso);
  if (!date) return "-";
  try {
    return new Intl.DateTimeFormat(appLocale(), options).format(date);
  } catch {
    return date.toISOString();
  }
}

/** "4 nov. 2026, 17:30" in the current language. */
export function formatDateTime(iso: string | number | Date | null | undefined): string {
  return format(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "4 nov. 2026" in the current language. */
export function formatDate(iso: string | number | Date | null | undefined): string {
  return format(iso, { day: "numeric", month: "short", year: "numeric" });
}

/** "17:30" in the current language. */
export function formatTime(iso: string | number | Date | null | undefined): string {
  return format(iso, { hour: "2-digit", minute: "2-digit" });
}

/** Number with the current locale's separators ("12 345"). */
export function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value == null || Number.isNaN(value)) return "-";
  try {
    return new Intl.NumberFormat(appLocale(), { maximumFractionDigits }).format(value);
  } catch {
    return String(value);
  }
}
