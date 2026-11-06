import { router } from "expo-router";
import { CalendarClock, ChevronRight, FileText, Fuel, Gauge, Settings2, Truck, Users, Wrench } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { isQueued } from "@/api/client";
import { fetchVehicleOperationalUpdates, updateVehicleOperational } from "@/api/driver";
import type { VehicleOperationalUpdate } from "@/api/types";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useRefetchOnFocus } from "@/features/workforce/useRefetchOnFocus";
import {
  AppHeader,
  Badge,
  EmptyState,
  ErrorState,
  GlassCard,
  LicensePlate,
  ListItem,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
  StatRow,
  TextField,
} from "@/components/ui";
import { useT } from "@/i18n";
import { formatDate, formatDateTime, formatNumber } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { InlineMessage } from "@/features/common/InlineMessage";
import { errorMessage } from "@/features/common/media";
import { SecureImage } from "@/features/common/SecureImage";
import { FuelLevelPicker } from "@/features/driver/FuelLevelPicker";
import { useDriverProfile, useDriverVehicle } from "@/features/driver/hooks";
import { colors, fonts, radius, spacing, themedStyles } from "@/theme/tokens";

function parseFuel(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value.replace("%", ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n / 10) * 10)) : null;
}

/** Mon véhicule (DriverVehiclePage du web) : véhicule attitré et check-up rapide (odomètre, carburant). */
export default function VehicleScreen() {
  const { t } = useT();
  const profile = useDriverProfile();
  const vehicleQuery = useDriverVehicle(profile.data?.assignedVehicleId);
  const vehicle = vehicleQuery.data;
  const op = vehicle?.operationalParameters;
  const vehicleId = vehicle?.id;
  const readings = useApiQuery<VehicleOperationalUpdate[]>(
    `driver:vehicle-readings:${vehicleId ?? "none"}`,
    () => fetchVehicleOperationalUpdates(vehicleId as string, 1),
    [vehicleId],
    { enabled: Boolean(vehicleId) }
  );
  const lastReading = (readings.data ?? []).find((r) => r.accepted);
  // Véhicule attribué, changé ou retiré par le gestionnaire : relu au retour sur l'onglet.
  useRefetchOnFocus(profile.refetch, vehicleQuery.refetch, readings.refetch);
  const [odometer, setOdometer] = useState("");
  // Jauge choisie par le chauffeur ; à défaut, celle du dernier relevé connu.
  const [fuelChoice, setFuelLevel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fuelLevel = fuelChoice ?? parseFuel(op?.fuelLevel) ?? 50;

  async function saveOperational() {
    if (!vehicle) return;
    const value = odometer.trim() ? Number(odometer.replace(",", ".")) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      setMsg({ ok: false, text: t("Kilométrage invalide.") });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const result = await updateVehicleOperational(vehicle.id, { odometerReading: value, fuelLevel: `${fuelLevel}%` });
      setOdometer("");
      setFuelLevel(null);
      if (isQueued(result)) {
        // Offline: the reading waits in the queue, the vehicle is reloaded once it is sent.
        setMsg({ ok: true, text: t("Relevé enregistré hors ligne : envoi automatique au retour du réseau.") });
        return;
      }
      setMsg({ ok: true, text: t("Relevé enregistré.") });
      await vehicleQuery.refetch();
      void readings.refetch();
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err, "Échec de l'enregistrement.") });
    } finally {
      setSaving(false);
    }
  }

  const loading = (profile.loading && !profile.data) || (vehicleQuery.loading && !vehicle);

  return (
    <Screen
      withTabBar
      header={<AppHeader title={t("Mon véhicule")} />}
      refreshing={profile.refreshing || vehicleQuery.refreshing}
      onRefresh={() => {
        void profile.refetch();
        void vehicleQuery.refetch();
      }}
    >
      <View style={styles.stack}>
        {loading ? (
          <LoadingState />
        ) : profile.error && !profile.data ? (
          <ErrorState message={profile.error} onRetry={() => void profile.refetch()} />
        ) : !vehicle ? (
          <EmptyState icon={Truck} title={t("Aucun véhicule assigné.")} message={t("Aucun véhicule assigné. Contactez votre gestionnaire.")} />
        ) : (
          <>
            <GlassCard strong padding={20}>
              <View style={styles.hero}>
                {vehicle.photoUrl ? (
                  <SecureImage url={vehicle.photoUrl} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]}>
                    <Truck size={34} color={colors.accentSoft} />
                  </View>
                )}
                <View style={{ flex: 1, gap: spacing(2) }}>
                  <LicensePlate plate={vehicle.licensePlate} size="md" />
                  <Text style={styles.model}>
                    {vehicle.brand} {vehicle.model}
                  </Text>
                  <View style={styles.badges}>
                    <Badge label={t("Véhicule assigné")} tone="success" />
                    <Badge label={codeLabel(vehicle.status, "vehicleStatus")} tone="muted" />
                  </View>
                </View>
              </View>
            </GlassCard>

            <GlassCard>
              <StatRow
                items={[
                  { icon: Gauge, label: t("Odomètre (km)"), value: op?.odometerReading != null ? formatNumber(op.odometerReading) : "-" },
                  { icon: Fuel, label: t("Carburant"), value: op?.fuelLevel ?? "-" },
                  { icon: Settings2, label: t("Boîte"), value: vehicle.transmissionType ? codeLabel(vehicle.transmissionType, "transmission") : "-" },
                  { icon: Users, label: t("Places"), value: vehicle.totalSeatNumber != null ? String(vehicle.totalSeatNumber) : "-" },
                ]}
              />
            </GlassCard>

            <SectionHeader title={t("Check-up rapide")} />
            <GlassCard>
              <View style={{ gap: spacing(4) }}>
                <TextField
                  label={t("Odomètre (km)")}
                  value={odometer}
                  onChangeText={setOdometer}
                  keyboardType="numeric"
                  icon={Gauge}
                  placeholder={op?.odometerReading != null ? String(op.odometerReading) : "87420"}
                />
                <FuelLevelPicker label={t("Carburant (%)")} value={fuelLevel} onChange={setFuelLevel} />
                {lastReading ? (
                  <Text style={styles.reading}>
                    {t("Dernier relevé")} : {formatDateTime(lastReading.createdAt)}
                    {lastReading.authorName ? ` · ${lastReading.authorName}` : ""}
                  </Text>
                ) : null}
                <InlineMessage text={msg?.text} tone={msg?.ok ? "success" : "danger"} />
                <PillButton
                  label={saving ? t("Enregistrement…") : t("Mettre à jour")}
                  size="lg"
                  loading={saving}
                  disabled={saving}
                  onPress={() => void saveOperational()}
                />
              </View>
            </GlassCard>

            <SectionHeader title={t("Informations")} />
            <GlassCard padding={4}>
              <ListItem
                title={t("Carburant")}
                subtitle={[vehicle.fuelType ? codeLabel(vehicle.fuelType) : null, vehicle.tankCapacity ? `${vehicle.tankCapacity} L` : null]
                  .filter(Boolean)
                  .join(" · ") || "-"}
                left={<Fuel size={20} color={colors.accentSoft} />}
              />
              <ListItem
                title={t("Prochaine maintenance")}
                subtitle={vehicle.maintenanceParameters?.nextMaintenanceDue ? formatDate(vehicle.maintenanceParameters.nextMaintenanceDue) : "-"}
                left={<Wrench size={20} color={colors.accentSoft} />}
              />
              <ListItem
                title={t("Assurance")}
                subtitle={vehicle.financialParameters?.insuranceExpiryDate ? formatDate(vehicle.financialParameters.insuranceExpiryDate) : "-"}
                left={<CalendarClock size={20} color={colors.accentSoft} />}
              />
              <ListItem
                title={t("Papiers de mon véhicule")}
                left={<FileText size={20} color={colors.accentSoft} />}
                right={<ChevronRight size={18} color={colors.textMuted} />}
                onPress={() => router.push("/documents")}
              />
              <ListItem
                title={t("Signaler Maintenance")}
                left={<Wrench size={20} color={colors.warning} />}
                right={<ChevronRight size={18} color={colors.textMuted} />}
                onPress={() => router.push({ pathname: "/declare/[kind]", params: { kind: "maintenance" } })}
              />
            </GlassCard>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  hero: { flexDirection: "row", gap: spacing(4), alignItems: "center" },
  photo: { width: 96, height: 96, borderRadius: radius.md },
  photoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.track },
  model: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  reading: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
}));
