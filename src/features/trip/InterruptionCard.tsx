import { router } from "expo-router";
import { AlertTriangle, PlayCircle } from "lucide-react-native";
import { Text, View } from "react-native";
import type { ApiTrip } from "@/api/types";
import { GlassCard, PillButton } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

/** Mission interrompue par un incident (véhicule immobilisé), puis reprise : état et lien vers le dossier. */
export function InterruptionCard({ trip }: { trip: Pick<ApiTrip, "interruptedAt" | "resumedAt" | "interruptionIncidentId"> }) {
  const { t } = useT();
  if (!trip.interruptedAt) return null;
  const ongoing = !trip.resumedAt;
  const Icon = ongoing ? AlertTriangle : PlayCircle;
  return (
    <GlassCard style={ongoing ? { borderColor: tint(colors.danger, 0.55), backgroundColor: tint(colors.danger, 0.1) } : undefined}>
      <View style={styles.inline}>
        <Icon size={20} color={ongoing ? colors.danger : colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {ongoing ? t("Mission interrompue : le véhicule est immobilisé par un incident.") : t("Mission reprise après un incident")}
          </Text>
          <Text style={styles.small}>
            {t("Interrompue le")} {formatDateTime(trip.interruptedAt)}
            {trip.resumedAt ? ` · ${t("reprise le")} ${formatDateTime(trip.resumedAt)}` : ""}
          </Text>
        </View>
      </View>
      {trip.interruptionIncidentId ? (
        <PillButton
          label={t("Voir le dossier")}
          variant="ghost"
          style={{ marginTop: spacing(2) }}
          onPress={() => router.push({ pathname: "/incident/[id]", params: { id: trip.interruptionIncidentId as string } })}
        />
      ) : null}
    </GlassCard>
  );
}

const styles = themedStyles(() => ({
  inline: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  title: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
}));
