import { router } from "expo-router";
import { ArrowRight, CalendarClock, Moon } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { isQueued } from "@/api/client";
import { acknowledgeAssignment } from "@/api/driver";
import type { AssignmentResponse } from "@/api/types";
import { Badge, GlassCard, LicensePlate, PillButton } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDate, formatTime } from "@/i18n/format";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";
import { InlineMessage } from "../common/InlineMessage";
import { errorMessage } from "../common/media";
import { usePendingActions } from "../offline/hooks";
import { useDriverVehicle } from "./hooks";
import { ASSIGNMENT_STATUS, isNightShift, needsAck } from "./rules";

/** Statuts absents de la table commune (rules.ts) : poste où le chauffeur a été marqué absent. */
const EXTRA_STATUS: Record<string, { label: string; tone: "danger" }> = {
  NO_SHOW: { label: "Absent", tone: "danger" },
};

/**
 * Poste planifié par le gestionnaire. Un poste nouveau ou modifié doit être confirmé par le
 * chauffeur (« J'ai pris connaissance de ce poste »), le motif de modification est affiché.
 */
export function AssignmentCard({
  assignment,
  onAcknowledged,
  compact = false,
}: {
  assignment: AssignmentResponse;
  onAcknowledged?: () => void;
  compact?: boolean;
}) {
  const { t } = useT();
  const { data: vehicle } = useDriverVehicle(assignment.vehicleId);
  const st = ASSIGNMENT_STATUS[assignment.status] ?? EXTRA_STATUS[assignment.status] ?? ASSIGNMENT_STATUS.PENDING;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirmation saved offline: shown as done, sent automatically when the network returns.
  const queuedAck = usePendingActions("acknowledge", `/api/v1/assignments/${assignment.id}/acknowledge`).length > 0;
  const pendingAck = needsAck(assignment) && !queuedAck;
  const night = isNightShift(assignment);

  async function acknowledge() {
    setBusy(true);
    setError(null);
    try {
      const result = await acknowledgeAssignment(assignment.id);
      if (!isQueued(result)) onAcknowledged?.();
    } catch (err) {
      setError(errorMessage(err, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard
      onPress={compact ? () => router.push("/assignments") : undefined}
      style={pendingAck ? { borderColor: tint(colors.warning, 0.55) } : undefined}
    >
      <View style={styles.row}>
        <View style={[styles.tile, night && { backgroundColor: tint(colors.accent, 0.25) }]}>
          {night ? <Moon size={22} color={colors.accentSoft} /> : <CalendarClock size={22} color={colors.accentSoft} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.day}>
            {formatDate(assignment.startDatetime)}
            {night ? ` · ${t("Poste de nuit")}` : ""}
          </Text>
          <Text style={styles.hours}>
            {formatTime(assignment.startDatetime)} → {formatTime(assignment.endDatetime)}
            {night ? ` (${formatDate(assignment.endDatetime)})` : ""}
          </Text>
        </View>
        <View style={styles.badges}>
          <Badge label={t(st.label)} tone={st.tone} />
          {assignment.acknowledgedAt ? <Badge label={t("Confirmé")} tone="success" /> : null}
          {queuedAck && !assignment.acknowledgedAt ? <Badge label={t("Confirmé (en attente d'envoi)")} tone="warning" /> : null}
        </View>
      </View>

      {pendingAck && assignment.changeReason ? (
        <View style={styles.changed}>
          <Text style={styles.changedText}>
            {t("Poste modifié")} : {assignment.changeReason}
          </Text>
        </View>
      ) : null}
      {assignment.status === "NO_SHOW" ? (
        <View style={[styles.changed, { backgroundColor: tint(colors.danger, 0.12) }]}>
          <Text style={[styles.changedText, { color: colors.danger }]}>
            {t("Vous avez été marqué absent à ce poste. Contactez votre gestionnaire si c'est une erreur.")}
          </Text>
        </View>
      ) : null}
      {assignment.notes ? (
        <Text style={styles.muted} numberOfLines={compact ? 2 : undefined}>
          {t("Consigne du gestionnaire")} : {assignment.notes}
        </Text>
      ) : null}
      {assignment.cancelReason ? (
        <Text style={styles.muted}>
          {t("Motif d'annulation")} : {assignment.cancelReason}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <LicensePlate plate={vehicle?.licensePlate ?? "-"} size="sm" />
        {vehicle ? (
          <Text style={styles.vehicle} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
        ) : null}
      </View>

      {!compact ? (
        <View style={{ gap: spacing(2), marginTop: spacing(3) }}>
          <InlineMessage text={error} />
          {pendingAck ? (
            <PillButton
              label={busy ? t("Patientez…") : t("J'ai pris connaissance de ce poste")}
              variant="glass"
              loading={busy}
              disabled={busy}
              onPress={() => void acknowledge()}
            />
          ) : null}
          {assignment.status === "PLANNED" || assignment.status === "PENDING" ? (
            <PillButton label={t("Démarrer le trajet")} icon={ArrowRight} onPress={() => router.push("/trip/active")} />
          ) : null}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: "row", gap: spacing(3), alignItems: "center" },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  hours: { fontFamily: fonts.display, fontSize: 17, color: colors.text, marginTop: 2 },
  badges: { alignItems: "flex-end", gap: spacing(1.5) },
  changed: {
    marginTop: spacing(3),
    padding: spacing(3),
    borderRadius: radius.sm,
    backgroundColor: tint(colors.warning, 0.12),
  },
  changedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.warning },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: spacing(2) },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing(3), marginTop: spacing(3) },
  vehicle: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
}));
