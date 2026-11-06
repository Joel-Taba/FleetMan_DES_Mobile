import { router } from "expo-router";
import { ArrowRight, CalendarClock, ChevronRight, Gauge, Navigation, Route, Timer } from "lucide-react-native";
import { Text, View } from "react-native";
import {
  AppHeader,
  Badge,
  EmptyState,
  ErrorState,
  GlassCard,
  ListItem,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
  StatRow,
} from "@/components/ui";
import { useT } from "@/i18n";
import { formatNumber } from "@/i18n/format";
import { useDriverActiveTrip, useDriverAssignments, useDriverTripHistory } from "@/features/driver/hooks";
import { durationLabel, needsAck, stopProgress, tripDestination, tripDistance } from "@/features/driver/rules";
import { TripRow } from "@/features/driver/TripCard";
import { pastTrips, upcomingTrips } from "@/features/trip/tripLists";
import { useLiveRefresh } from "@/features/trip/useLiveRefresh";
import { colors, fonts, monoFont, spacing, themedStyles } from "@/theme/tokens";

/** Mes trajets (DriverTrips du web) : course active, accès aux postes, historique. */
export default function TripsScreen() {
  const { t } = useT();
  const active = useDriverActiveTrip();
  const assignments = useDriverAssignments(false);
  const history = useDriverTripHistory();

  const trip = active.data ?? null;
  const all = history.data ?? [];
  const upcoming = upcomingTrips(all);
  const list = pastTrips(all, trip?.id);
  const toAck = (assignments.data ?? []).filter(needsAck).length;
  const completed = list.filter((x) => x.status === "COMPLETED");
  const kmKnown = completed.filter((x) => tripDistance(x) != null);
  const totalKm = kmKnown.reduce((sum, x) => sum + (tripDistance(x) ?? 0), 0);
  const totalMinutes = completed.reduce((sum, x) => sum + (x.durationMinutes ?? 0), 0);

  function refresh() {
    return Promise.all([active.refetch(), assignments.refetch(), history.refetch()]);
  }
  // Trajets assignés, modifiés ou annulés par le gestionnaire : relus au retour sur l'onglet.
  const { pulling, onPull } = useLiveRefresh(refresh, 60_000);

  return (
    <Screen
      withTabBar
      header={<AppHeader title={t("Mes trajets & affectations")} />}
      refreshing={pulling}
      onRefresh={() => void onPull()}
    >
      <View style={styles.stack}>
        <GlassCard strong onPress={() => router.push("/trip/active")}>
          <View style={styles.row}>
            <View style={styles.tile}>
              <Navigation size={22} color={trip ? colors.success : colors.accentSoft} />
            </View>
            <View style={{ flex: 1 }}>
              {trip ? (
                <>
                  <Text style={styles.code}>{trip.tripCode}</Text>
                  <Text style={styles.title} numberOfLines={1}>
                    → {tripDestination(trip) ?? t("Destination non précisée")}
                  </Text>
                  <Text style={styles.sub}>
                    {stopProgress(trip).done} / {stopProgress(trip).total} {t("arrêt(s) clos")}
                  </Text>
                </>
              ) : (
                <Text style={styles.title}>{t("Aucune course active : ouvrir l'écran trajet")}</Text>
              )}
            </View>
            {trip ? <Badge label={t("En cours")} tone="warning" /> : <ChevronRight size={18} color={colors.textMuted} />}
          </View>
          {trip ? (
            <PillButton label={t("Voir la course active")} icon={ArrowRight} style={{ marginTop: spacing(4) }} onPress={() => router.push("/trip/active")} />
          ) : null}
        </GlassCard>

        <GlassCard padding={4}>
          <ListItem
            title={t("Mes affectations")}
            subtitle={toAck > 0 ? `${toAck} ${t("poste(s) nouveau(x) ou modifié(s) à confirmer")}` : t("Vos créneaux planifiés par le gestionnaire de flotte.")}
            left={<CalendarClock size={22} color={toAck > 0 ? colors.warning : colors.accentSoft} />}
            right={<ChevronRight size={18} color={colors.textMuted} />}
            onPress={() => router.push("/assignments")}
          />
        </GlassCard>

        <SectionHeader title={t("Trajets à venir")} />
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t("Aucun trajet planifié pour le moment.")} />
        ) : (
          <View style={{ gap: spacing(3) }}>
            {upcoming.map((x) => (
              <TripRow key={x.id} trip={x} />
            ))}
          </View>
        )}

        <SectionHeader title={t("Historique")} />
        {completed.length > 0 ? (
          <GlassCard>
            <StatRow
              items={[
                { icon: Route, label: t("Trajets"), value: String(completed.length) },
                { icon: Gauge, label: t("Distance"), value: kmKnown.length > 0 ? `${formatNumber(totalKm)} km` : "-" },
                { icon: Timer, label: t("Durée"), value: durationLabel(totalMinutes) },
              ]}
            />
          </GlassCard>
        ) : null}

        {history.loading && !history.data ? (
          <LoadingState />
        ) : history.error && !history.data ? (
          <ErrorState message={history.error} onRetry={() => void history.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={Route} title={t("Aucun trajet terminé pour l'instant.")} />
        ) : (
          <View style={{ gap: spacing(3) }}>
            {list.map((x) => (
              <TripRow key={x.id} trip={x} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  tile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  code: { fontFamily: monoFont, fontSize: 12, color: colors.accentSoft },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
}));
