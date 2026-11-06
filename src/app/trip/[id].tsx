import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Fuel, Gauge, Route, Timer } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { fetchTripSubmissions } from "@/api/driver";
import type { MissionSubmission } from "@/api/types";
import {
  AppHeader,
  Badge,
  Divider,
  EmptyState,
  ErrorState,
  GlassCard,
  LicensePlate,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
  StatRow,
} from "@/components/ui";
import { useT } from "@/i18n";
import { codeLabel } from "@/i18n/labels";
import { formatDate, formatDateTime, formatNumber } from "@/i18n/format";
import { useDriverTripHistory, useDriverVehicle } from "@/features/driver/hooks";
import { durationLabel, hhmm, stopProgress, tripDestination, tripDistance, tripStatusLabel, tripStatusTone } from "@/features/driver/rules";
import { InterruptionCard } from "@/features/trip/InterruptionCard";
import { StopList } from "@/features/trip/StopList";
import { useLiveRefresh } from "@/features/trip/useLiveRefresh";
import { colors, fonts, monoFont, spacing, themedStyles } from "@/theme/tokens";

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value || "-"}</Text>
    </View>
  );
}

/**
 * Détail d'un trajet (à venir, en cours ou passé), lu dans les trajets du chauffeur
 * (GET /trips/my-history) : l'API ne donne pas la fiche d'un trajet au chauffeur (GET /trips/{id}
 * réservé au gestionnaire). Montre aussi les changements de chargement et la décision du gestionnaire.
 */
export default function TripDetailScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const history = useDriverTripHistory();
  const trip = (history.data ?? []).find((x) => x.id === id) ?? null;
  const { data: vehicle } = useDriverVehicle(trip?.vehicleId);
  const [submissions, setSubmissions] = useState<MissionSubmission[]>([]);
  const tripId = trip?.id;
  const planned = trip?.status === "SCHEDULED";

  async function loadSubmissions() {
    if (!tripId || planned) return;
    await fetchTripSubmissions(tripId).then(
      (list) => setSubmissions(list ?? []),
      () => undefined
    );
  }
  useEffect(() => {
    void loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, planned]);

  // Modifications du gestionnaire (horaire, arrêts, annulation) relues au retour sur l'écran.
  const { pulling, onPull } = useLiveRefresh(() => Promise.all([history.refetch(), loadSubmissions()]), 60_000);

  const header = <AppHeader title={trip?.tripCode ?? t("Trajet")} subtitle={trip ? formatDate(trip.startDate) : undefined} onBack={() => router.back()} />;

  if (!trip) {
    return (
      <Screen header={header}>
        {history.loading ? (
          <LoadingState />
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={() => void history.refetch()} />
        ) : (
          <EmptyState icon={Route} title={t("Trajet introuvable.")} message={t("Il a pu être retiré ou supprimé par votre gestionnaire.")} />
        )}
      </Screen>
    );
  }

  const km = tripDistance(trip);
  const { done, total } = stopProgress(trip);
  const fuelUsed =
    trip.computedFuelConsumed ??
    (trip.departureFuelIndex != null && trip.returnFuelIndex != null ? trip.departureFuelIndex - trip.returnFuelIndex : null);

  return (
    <Screen header={header} refreshing={pulling} onRefresh={() => void onPull()}>
      <View style={styles.stack}>
        <GlassCard strong padding={20}>
          <View style={styles.head}>
            <Badge label={tripStatusLabel(trip.status)} tone={tripStatusTone(trip.status)} />
            <Text style={styles.code}>{trip.tripCode}</Text>
          </View>
          <Text style={styles.mission}>{trip.missionObject || t("Tournée")}</Text>
          <Text style={styles.dest}>→ {tripDestination(trip) ?? t("Destination non précisée")}</Text>
          <View style={styles.plateRow}>
            <LicensePlate plate={vehicle?.licensePlate ?? "-"} />
            {vehicle ? (
              <Text style={styles.small}>
                {vehicle.brand} {vehicle.model}
              </Text>
            ) : null}
          </View>
        </GlassCard>

        <GlassCard>
          <StatRow
            items={[
              { icon: Route, label: t("Distance"), value: km != null ? `${formatNumber(km, 1)} km` : "-" },
              { icon: Timer, label: t("Durée"), value: durationLabel(trip.durationMinutes) },
              { icon: Fuel, label: t("Carburant"), value: fuelUsed != null ? `${formatNumber(fuelUsed, 1)} L` : "-" },
              { icon: Gauge, label: t("Arrêts"), value: total > 0 ? `${done}/${total}` : "-" },
            ]}
          />
        </GlassCard>

        <GlassCard>
          <Fact label={t("Départ")} value={`${formatDate(trip.startDate)} · ${hhmm(trip.startTime)}${trip.departureLocation ? ` · ${trip.departureLocation}` : ""}`} />
          <Divider />
          <Fact label={t("Retour prévu")} value={trip.scheduledReturnDatetime ? formatDateTime(trip.scheduledReturnDatetime) : null} />
          <Divider />
          <Fact label={t("Arrivée")} value={trip.arrivedAt ? `${formatDateTime(trip.arrivedAt)}${trip.arrivalLocation ? ` · ${trip.arrivalLocation}` : ""}` : null} />
          <Divider />
          <Fact
            label={t("Retour")}
            value={trip.endDate ? `${formatDate(trip.endDate)} · ${hhmm(trip.endTime)}${trip.returnLocation ? ` · ${trip.returnLocation}` : ""}` : null}
          />
          <Divider />
          <Fact
            label={t("Kilométrage")}
            value={
              trip.departureKmIndex != null
                ? `${formatNumber(trip.departureKmIndex)} → ${trip.returnKmIndex != null ? formatNumber(trip.returnKmIndex) : "-"} km`
                : null
            }
          />
          {trip.cancelReason ? (
            <>
              <Divider />
              <Fact label={t("Motif d'annulation")} value={trip.cancelReason} />
            </>
          ) : null}
          {trip.arrivalNotes ? (
            <>
              <Divider />
              <Fact label={t("Remarques")} value={trip.arrivalNotes} />
            </>
          ) : null}
        </GlassCard>

        <InterruptionCard trip={trip} />

        {trip.status === "DEPARTED" || trip.status === "ARRIVED" ? (
          <PillButton label={t("Voir la course active")} icon={ArrowRight} onPress={() => router.replace("/trip/active")} />
        ) : null}
        {planned ? (
          <GlassCard>
            <Text style={styles.small}>{t("Le départ est enregistré par votre gestionnaire.")}</Text>
          </GlassCard>
        ) : null}

        {total > 0 ? (
          <>
            <SectionHeader title={t("Arrêts de la tournée")} />
            <StopList stops={trip.stops ?? []} details={(trip.details ?? []).filter((d) => d.id)} />
          </>
        ) : null}

        {submissions.length > 0 ? (
          <>
            <SectionHeader title={t("Changements de chargement signalés")} />
            <GlassCard>
              {submissions.map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.subRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.factValue}>
                        {s.changeType === "REMOVE" ? "−" : "+"} {s.description || codeLabel(s.itemType)} {s.quantity ? `× ${s.quantity}` : ""}
                      </Text>
                      {s.rejectionReason ? (
                        <Text style={[styles.small, { color: colors.danger }]}>
                          {t("Motif du refus")} : {s.rejectionReason}
                        </Text>
                      ) : null}
                      {s.reviewedAt ? (
                        <Text style={styles.small}>
                          {t("Traité")} {formatDateTime(s.reviewedAt)}
                        </Text>
                      ) : null}
                    </View>
                    <Badge label={codeLabel(s.status)} tone={s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "danger" : "muted"} />
                  </View>
                </View>
              ))}
            </GlassCard>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontFamily: monoFont, fontSize: 13, color: colors.textSecondary },
  mission: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing(4) },
  dest: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: spacing(1) },
  plateRow: { flexDirection: "row", alignItems: "center", gap: spacing(3), marginTop: spacing(3), flexWrap: "wrap" },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  fact: { paddingVertical: spacing(2.5), gap: 2 },
  factLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  factValue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing(3), paddingVertical: spacing(2.5) },
}));
