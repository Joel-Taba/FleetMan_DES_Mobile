import { router } from "expo-router";
import { BellRing, CalendarClock, CheckCheck, Clock, Moon } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { isQueued } from "@/api/client";
import { acknowledgeAssignment } from "@/api/driver";
import {
  AppHeader,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
  StatRow,
} from "@/components/ui";
import { useT } from "@/i18n";
import { InlineMessage } from "@/features/common/InlineMessage";
import { errorMessage } from "@/features/common/media";
import { queuedMessage, useOfflineQueue } from "@/features/offline/hooks";
import { AssignmentCard } from "@/features/driver/AssignmentCard";
import { useDriverAssignments, useDriverId } from "@/features/driver/hooks";
import { AbsenceSection } from "@/features/workforce/AbsenceSection";
import { useRefetchOnFocus } from "@/features/workforce/useRefetchOnFocus";
import { isNightShift, needsAck } from "@/features/driver/rules";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

/** Mes postes (DriverAssignments du web) : accusé de réception, « Tout confirmer », postes de nuit. */
export default function AssignmentsScreen() {
  const { t } = useT();
  const { data, loading, refreshing, error, refetch } = useDriverAssignments(false);
  const driverId = useDriverId();
  // Heure de référence (à venir / historique), remise à jour à chaque retour sur l'écran.
  const [now, setNow] = useState(() => Date.now());
  // Poste ajouté, modifié ou annulé par le gestionnaire : relu au retour sur l'écran.
  useRefetchOnFocus(refetch, () => setNow(Date.now()));
  const [ackAllBusy, setAckAllBusy] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const list = useMemo(() => data ?? [], [data]);
  // Confirmations already saved offline are not asked again.
  const { pending: queuedActions } = useOfflineQueue();
  const queuedAckPaths = new Set(queuedActions.filter((q) => q.kind === "acknowledge").map((q) => q.path));
  const toAck = list.filter((a) => needsAck(a) && !queuedAckPaths.has(`/api/v1/assignments/${a.id}/acknowledge`));
  const [ackNotice, setAckNotice] = useState<string | null>(null);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...list].sort((a, b) => a.startDatetime.localeCompare(b.startDatetime));
    return {
      upcoming: sorted.filter((a) => new Date(a.endDatetime).getTime() >= now && a.status !== "COMPLETED"),
      past: sorted.filter((a) => new Date(a.endDatetime).getTime() < now || a.status === "COMPLETED").reverse(),
    };
  }, [list, now]);
  const hours = upcoming
    .filter((a) => a.status !== "CANCELLED")
    .reduce((sum, a) => sum + (new Date(a.endDatetime).getTime() - new Date(a.startDatetime).getTime()) / 3600000, 0);

  async function acknowledgeAll() {
    setAckAllBusy(true);
    setAckError(null);
    setAckNotice(null);
    try {
      let queued = false;
      for (const a of toAck) if (isQueued(await acknowledgeAssignment(a.id))) queued = true;
      if (queued) setAckNotice(queuedMessage());
    } catch (err) {
      setAckError(errorMessage(err, "Action impossible."));
    } finally {
      setAckAllBusy(false);
      void refetch();
    }
  }

  return (
    <Screen
      header={<AppHeader title={t("Mes affectations")} subtitle={t("Vos créneaux planifiés par le gestionnaire de flotte.")} onBack={() => router.back()} />}
      refreshing={refreshing}
      onRefresh={() => void refetch()}
    >
      <View style={styles.stack}>
        {toAck.length > 0 ? (
          <GlassCard style={{ borderColor: tint(colors.warning, 0.55), backgroundColor: tint(colors.warning, 0.1) }}>
            <View style={styles.banner}>
              <BellRing size={20} color={colors.warning} />
              <Text style={styles.bannerText}>
                {toAck.length} {t("poste(s) nouveau(x) ou modifié(s) à confirmer")}
              </Text>
            </View>
            <PillButton
              label={t("Tout confirmer")}
              icon={CheckCheck}
              iconPosition="left"
              loading={ackAllBusy}
              disabled={ackAllBusy}
              style={{ marginTop: spacing(3) }}
              onPress={() => void acknowledgeAll()}
            />
            {ackError ? <View style={{ marginTop: spacing(2) }}><InlineMessage text={ackError} /></View> : null}
          </GlassCard>
        ) : null}
        <InlineMessage text={ackNotice} tone="info" />

        {upcoming.length > 0 ? (
          <GlassCard>
            <StatRow
              items={[
                { icon: CalendarClock, label: t("À venir"), value: String(upcoming.length) },
                { icon: Clock, label: t("Heures"), value: `${Math.round(hours)} h` },
                { icon: Moon, label: t("Poste de nuit"), value: String(upcoming.filter(isNightShift).length) },
              ]}
            />
          </GlassCard>
        ) : null}

        {loading && !data ? (
          <LoadingState />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => void refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t("Aucune affectation.")} message={t("Vos créneaux planifiés par le gestionnaire de flotte.")} />
        ) : (
          <>
            {upcoming.length > 0 ? <SectionHeader title={t("En cours et à venir")} /> : null}
            {upcoming.map((a) => (
              <AssignmentCard key={a.id} assignment={a} onAcknowledged={() => void refetch()} />
            ))}
            {past.length > 0 ? <SectionHeader title={t("Historique")} /> : null}
            {past.map((a) => (
              <AssignmentCard key={a.id} assignment={a} onAcknowledged={() => void refetch()} />
            ))}
          </>
        )}

        {driverId ? <AbsenceSection driverId={driverId} /> : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  bannerText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
}));
