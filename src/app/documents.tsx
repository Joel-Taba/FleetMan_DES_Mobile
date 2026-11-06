import { router } from "expo-router";
import { Text, View } from "react-native";
import { AppHeader, ErrorState, GlassCard, LoadingState, Screen } from "@/components/ui";
import { fetchMyVehicles, type MyVehicle, type MyVehicleReason } from "@/api/driver";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useT } from "@/i18n";
import { DocumentDossier } from "@/features/documents/DocumentDossier";
import { useDriverId, useDriverProfile } from "@/features/driver/hooks";
import { useRefetchOnFocus } from "@/features/workforce/useRefetchOnFocus";
import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";

const REASON_LABELS: Record<MyVehicleReason, string> = {
  REGULAR: "Véhicule attitré",
  TRIP: "Trajet en cours",
  SHIFT: "Poste du jour",
};

/**
 * Mes documents (DriverDocuments du web) : mes pièces (dépôt, renouvellement) et les papiers
 * de chaque véhicule auquel je suis affecté (attitré, trajet en cours, poste du jour),
 * consultables et exportables en PDF pour un contrôle.
 */
export default function DocumentsScreen() {
  const { t } = useT();
  const driverId = useDriverId();
  const profile = useDriverProfile();
  const vehicles = useApiQuery<MyVehicle[]>(`driver:my-vehicles:${driverId}`, () => fetchMyVehicles(driverId), [driverId], {
    enabled: Boolean(driverId),
  });
  const driver = profile.data;
  // Véhicule attitré changé par le gestionnaire : ses papiers suivent.
  useRefetchOnFocus(profile.refetch, vehicles.refetch);
  const ownerName = driver ? [driver.firstName, driver.lastName].filter(Boolean).join(" ") || driver.username : null;

  return (
    <Screen
      header={<AppHeader title={t("Mes documents")} onBack={() => router.back()} />}
      refreshing={profile.refreshing || vehicles.refreshing}
      onRefresh={() => {
        void profile.refetch();
        void vehicles.refetch();
      }}
    >
      <View style={{ gap: spacing(5) }}>
        <GlassCard>
          <Text style={styles.intro}>
            {t("Déposez vos pièces : votre gestionnaire les contrôle. Une pièce obligatoire manquante ou expirée vous empêche d'être engagé.")}
          </Text>
        </GlassCard>
        {profile.loading && !driver ? (
          <LoadingState />
        ) : profile.error && !driver ? (
          <ErrorState message={profile.error} onRetry={() => void profile.refetch()} />
        ) : driver ? (
          <>
            <DocumentDossier kind="driver" targetId={driver.userId} canSubmit title={t("Mon dossier")} ownerName={ownerName} />
            {vehicles.loading && !vehicles.data ? <LoadingState /> : null}
            {vehicles.error && !vehicles.data ? <ErrorState message={vehicles.error} onRetry={() => void vehicles.refetch()} /> : null}
            {(vehicles.data ?? []).map((v) => (
              <DocumentDossier
                key={v.vehicleId}
                kind="vehicle"
                targetId={v.vehicleId}
                title={v.licensePlate ? `${t("Papiers du véhicule")} ${v.licensePlate}` : t("Papiers de mon véhicule")}
                caption={[v.reasons.map((r) => t(REASON_LABELS[r] ?? r)).join(" · "), v.label].filter(Boolean).join(" · ")}
                vehicle={{ licensePlate: v.licensePlate, label: v.label }}
              />
            ))}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  intro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
}));
