import { CalendarOff, Send, Undo2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { createAbsenceRequest, fetchMyAbsenceRequests, fetchMyAbsences, withdrawAbsenceRequest } from "@/api/driver";
import type { AbsenceRequest, DriverAbsence } from "@/api/types";
import { Badge, GlassCard, PillButton, SectionHeader, TextField, DateField } from "@/components/ui";
import type { BadgeTone } from "@/components/ui/Badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useT } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { InlineMessage } from "@/features/common/InlineMessage";
import { errorMessage } from "@/features/common/media";
import { localDay } from "@/features/driver/rules";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";
import { useRefetchOnFocus } from "./useRefetchOnFocus";

const REQUEST_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "En attente", tone: "warning" },
  APPROVED: { label: "Acceptée", tone: "success" },
  REJECTED: { label: "Refusée", tone: "danger" },
  WITHDRAWN: { label: "Retirée", tone: "muted" },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mes absences (écran « Mes affectations ») : absences enregistrées par le gestionnaire et
 * demandes d'absence du chauffeur (congé, arrêt maladie) avec la décision du gestionnaire.
 */
export function AbsenceSection({ driverId }: { driverId: string }) {
  const { t } = useT();
  const absences = useApiQuery<DriverAbsence[]>(`driver:absences:${driverId}`, () => fetchMyAbsences(driverId), [driverId], {
    enabled: Boolean(driverId),
  });
  const requests = useApiQuery<AbsenceRequest[]>(
    `driver:absence-requests:${driverId}`,
    () => fetchMyAbsenceRequests(driverId),
    [driverId],
    { enabled: Boolean(driverId) }
  );
  useRefetchOnFocus(absences.refetch, requests.refetch);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [type, setType] = useState<"LEAVE" | "SICK_LEAVE">("LEAVE");
  const [start, setStart] = useState(localDay());
  const [end, setEnd] = useState(localDay());
  const [reason, setReason] = useState("");
  const today = localDay();

  const upcoming = (absences.data ?? [])
    .filter((a) => !a.cancelledAt && (!a.endDate || a.endDate >= today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recent = (requests.data ?? []).slice(0, 5);

  function period(s: string, e: string | null) {
    if (!e) return `${t("Depuis le")} ${formatDate(s)} (${t("sans date de fin")})`;
    return s === e ? formatDate(s) : `${formatDate(s)} → ${formatDate(e)}`;
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setMsg({ ok: true, text: success });
      void requests.refetch();
      void absences.refetch();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err, "Action impossible.") });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!DATE_RE.test(start) || !DATE_RE.test(end) || end < start) {
      setMsg({ ok: false, text: t("Choisissez une date de début et une date de fin après le début.") });
      return;
    }
    const ok = await run(
      () => createAbsenceRequest(driverId, { type, startDate: start, endDate: end, reason: reason.trim() || null }),
      t("Demande envoyée à votre gestionnaire.")
    );
    if (ok) {
      setOpen(false);
      setReason("");
    }
  }

  return (
    <View style={styles.stack}>
      <SectionHeader title={t("Mes absences")} />
      {upcoming.length === 0 ? (
        <GlassCard>
          <Text style={styles.muted}>{t("Aucune absence en cours ou prévue.")}</Text>
        </GlassCard>
      ) : (
        upcoming.map((a) => (
          <GlassCard key={a.id}>
            <View style={styles.row}>
              <View style={[styles.tile, { backgroundColor: tint(a.type === "SUSPENSION" ? colors.danger : colors.warning, 0.18) }]}>
                <CalendarOff size={20} color={a.type === "SUSPENSION" ? colors.danger : colors.warning} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>{codeLabel(a.type)}</Text>
                <Text style={styles.muted}>
                  {period(a.startDate, a.endDate)}
                  {a.reason ? ` · ${a.reason}` : ""}
                </Text>
              </View>
              {a.startDate <= today ? <Badge label={t("En cours")} tone="default" /> : null}
            </View>
          </GlassCard>
        ))
      )}

      {recent.length > 0 ? (
        <GlassCard padding={4}>
          <Text style={[styles.title, { padding: spacing(3) }]}>{t("Mes demandes d'absence")}</Text>
          {recent.map((r) => {
            const st = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.PENDING;
            return (
              <View key={r.id} style={styles.request}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.body}>
                    {codeLabel(r.type)} · {period(r.startDate, r.endDate)}
                  </Text>
                  {r.decisionReason ? (
                    <Text style={[styles.muted, { color: colors.danger }]}>
                      {t("Motif du refus")} : {r.decisionReason}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing(1.5) }}>
                  <Badge label={t(st.label)} tone={st.tone} />
                  {r.status === "PENDING" ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void run(() => withdrawAbsenceRequest(driverId, r.id), t("Demande retirée."))}
                      style={styles.link}
                    >
                      <Undo2 size={14} color={colors.accentSoft} />
                      <Text style={styles.linkText}>{t("Retirer")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </GlassCard>
      ) : null}

      <InlineMessage text={msg?.text} tone={msg?.ok ? "success" : "danger"} />

      {open ? (
        <GlassCard>
          <View style={{ gap: spacing(3) }}>
            <View style={styles.types}>
              {(["LEAVE", "SICK_LEAVE"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => setType(value)}
                  style={[styles.chip, type === value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, type === value && { color: colors.text }]}>{codeLabel(value)}</Text>
                </Pressable>
              ))}
            </View>
            <DateField label={t("Début")} value={start} onChange={setStart} minimumDate={new Date()} />
            <DateField label={t("Fin")} value={end} onChange={setEnd} minimumDate={start ? new Date(`${start}T00:00:00`) : new Date()} />
            <TextField label={t("Motif (facultatif)")} value={reason} onChangeText={setReason} multiline />
            <Text style={styles.muted}>{t("Votre gestionnaire accepte ou refuse la demande ; vous êtes notifié de sa décision.")}</Text>
            <PillButton label={t("Envoyer la demande")} icon={Send} iconPosition="left" loading={busy} disabled={busy} onPress={() => void submit()} />
            <PillButton label={t("Annuler")} variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </GlassCard>
      ) : (
        <PillButton label={t("Demander une absence")} icon={CalendarOff} iconPosition="left" variant="glass" onPress={() => setOpen(true)} />
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(3) },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  tile: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  request: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    padding: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  link: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  linkText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accentSoft },
  types: { flexDirection: "row", gap: spacing(2) },
  chip: {
    flex: 1,
    paddingVertical: spacing(2.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
  },
  chipActive: { backgroundColor: tint(colors.accent, 0.35), borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textMuted },
}));
