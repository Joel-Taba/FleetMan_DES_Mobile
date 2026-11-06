import { router } from "expo-router";
import { MapPin, Route } from "lucide-react-native";
import { Text, View } from "react-native";
import type { ApiTrip } from "@/api/types";
import { Badge, GlassCard, LicensePlate } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDate, formatNumber } from "@/i18n/format";
import { colors, fonts, radius, monoFont, spacing, themedStyles } from "@/theme/tokens";
import { useDriverVehicle } from "./hooks";
import { hhmm, stopProgress, tripDestination, tripDistance, tripStatusLabel, tripStatusTone } from "./rules";

function openTrip(trip: ApiTrip) {
  router.push({ pathname: "/trip/[id]", params: { id: trip.id } });
}

/** Carte compacte (défilement horizontal de l'accueil) : code, destination, km. */
export function TripMiniCard({ trip }: { trip: ApiTrip }) {
  const { t } = useT();
  const km = tripDistance(trip);
  const destination = tripDestination(trip);
  return (
    <GlassCard style={styles.mini} onPress={() => openTrip(trip)}>
      <View style={styles.miniTile}>
        <Route size={22} color={colors.accentSoft} />
      </View>
      <Text style={styles.code} numberOfLines={1}>
        {trip.tripCode ?? trip.id.slice(0, 8)}
      </Text>
      <Text style={styles.miniDest} numberOfLines={2}>
        {destination ?? t("Destination non précisée")}
      </Text>
      <View style={styles.miniFoot}>
        <Text style={styles.km}>{km != null ? `${formatNumber(km, 1)} km` : "-"}</Text>
        <Text style={styles.date}>{formatDate(trip.startDate)}</Text>
      </View>
    </GlassCard>
  );
}

/** Ligne d'historique : tuile, trajet, véhicule, statut. */
export function TripRow({ trip }: { trip: ApiTrip }) {
  const { t } = useT();
  const { data: vehicle } = useDriverVehicle(trip.vehicleId);
  const km = tripDistance(trip);
  const { done, total } = stopProgress(trip);
  return (
    <GlassCard onPress={() => openTrip(trip)}>
      <View style={styles.row}>
        <View style={styles.tile}>
          <MapPin size={22} color={colors.accentSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.code}>{trip.tripCode ?? trip.id.slice(0, 8)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {tripDestination(trip) ?? trip.missionObject ?? t("Tournée")}
          </Text>
          <Text style={styles.sub}>
            {formatDate(trip.startDate)} · {hhmm(trip.startTime)}
            {total > 0 ? ` · ${done}/${total} ${t("arrêt(s) clos")}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing(2) }}>
          <Badge label={tripStatusLabel(trip.status)} tone={tripStatusTone(trip.status)} />
          <Text style={styles.km}>{km != null ? `${formatNumber(km, 1)} km` : ""}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(3), marginTop: spacing(3) }}>
        <LicensePlate plate={vehicle?.licensePlate ?? "-"} size="sm" />
        {vehicle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = themedStyles(() => ({
  mini: { width: 170, gap: spacing(1.5) },
  miniTile: {
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(1.5),
  },
  code: { fontFamily: monoFont, fontSize: 12, color: colors.accentSoft },
  miniDest: { fontFamily: fonts.display, fontSize: 15, color: colors.text, minHeight: 38 },
  miniFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  km: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.text },
  date: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  row: { flexDirection: "row", gap: spacing(3), alignItems: "center" },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.text, marginTop: 1 },
  sub: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
}));
