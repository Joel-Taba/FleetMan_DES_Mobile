/**
 * "AAAA-MM-JJ HH:MM" (ou avec un T) → "AAAA-MM-JJTHH:MM:00", heure locale sans fuseau,
 * comme le champ datetime-local du web. Null si la saisie n'est pas une date valide.
 */
export function parseLocalDateTime(input: string): string | null {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d) ||
    date.getHours() !== Number(h)
  ) {
    return null;
  }
  return `${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:00`;
}

/** "AAAA-MM-JJ" valide ? */
export function isIsoDay(input: string): boolean {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.getMonth() === Number(m[2]) - 1 && date.getDate() === Number(m[3]);
}
