import { CheckCircle2, Clock, PackageMinus, PackagePlus, Phone, UserRound, XCircle } from "lucide-react-native";
import { Text, View } from "react-native";
import type { TripDetailLine, TripStop } from "@/api/types";
import { Badge, GlassCard } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";
import { stopTone } from "../driver/rules";

/** Liste des arrêts de la tournée : statut, ponctualité, quantités traitées / chargées. */
export function StopList({
  stops,
  details,
  currentId,
}: {
  stops: TripStop[];
  details: TripDetailLine[];
  currentId?: string | null;
}) {
  const { t } = useT();
  return (
    <View style={{ gap: spacing(3) }}>
      {stops.map((stop) => {
        const lines = details.filter((d) => d.stopId === stop.id);
        const isCurrent = currentId === stop.id;
        const done = stop.status === "COMPLETED";
        const failed = stop.status === "FAILED";
        return (
          <GlassCard key={stop.id} style={isCurrent ? { borderColor: colors.accentSoft } : undefined}>
            <View style={styles.row}>
              <View
                style={[
                  styles.num,
                  done && { backgroundColor: colors.success },
                  failed && { backgroundColor: colors.danger },
                  stop.status === "SKIPPED" && { backgroundColor: colors.glassStrong },
                ]}
              >
                {done ? (
                  <CheckCircle2 size={16} color={colors.ctaText} />
                ) : failed ? (
                  <XCircle size={16} color={colors.ctaText} />
                ) : (
                  <Text style={styles.numText}>{stop.sequence}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: spacing(1) }}>
                <View style={styles.typeRow}>
                  {stop.stopType === "PICKUP" ? (
                    <PackagePlus size={14} color={colors.textMuted} />
                  ) : (
                    <PackageMinus size={14} color={colors.textMuted} />
                  )}
                  <Text style={styles.type}>{codeLabel(stop.stopType, "stopType")}</Text>
                </View>
                <Text style={styles.location}>{stop.location}</Text>
              </View>
              <Badge label={codeLabel(stop.status, "stopStatus")} tone={stopTone(stop.status)} />
            </View>

            <View style={styles.meta}>
              {stop.plannedArrival ? (
                <View style={styles.metaItem}>
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>
                    {t("Prévu")} {formatDateTime(stop.plannedArrival)}
                  </Text>
                </View>
              ) : null}
              {stop.arrivedAt ? (
                <Text style={styles.metaText}>
                  {t("Arrivée")} {formatDateTime(stop.arrivedAt)}
                </Text>
              ) : null}
              {stop.completedAt ? (
                <Text style={styles.metaText}>
                  {t("Clôture")} {formatDateTime(stop.completedAt)}
                </Text>
              ) : null}
              {stop.contactName ? (
                <View style={styles.metaItem}>
                  <UserRound size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{stop.contactName}</Text>
                </View>
              ) : null}
              {stop.contactPhone ? (
                <View style={styles.metaItem}>
                  <Phone size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{stop.contactPhone}</Text>
                </View>
              ) : null}
            </View>

            {stop.punctuality ? (
              <View style={{ flexDirection: "row", marginTop: spacing(2) }}>
                <Badge
                  label={`${codeLabel(stop.punctuality, "punctuality")}${
                    stop.punctuality === "LATE" && stop.delayMinutes != null ? ` (+${stop.delayMinutes} min)` : ""
                  }`}
                  tone={stop.punctuality === "LATE" ? "warning" : "muted"}
                />
              </View>
            ) : null}

            {(done && stop.recipientName) || stop.notes || stop.proofUrl ? (
              <Text style={styles.note}>
                {[
                  done && stop.recipientName ? `${t("Réceptionnaire")} : ${stop.recipientName}` : null,
                  stop.notes,
                  stop.proofUrl ? t("Preuve jointe") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            {failed || stop.status === "SKIPPED" ? (
              <Text style={styles.note}>
                {stop.failureReason ? codeLabel(stop.failureReason, "stopFailure") : ""}
                {stop.failureReason && stop.failureNotes ? " · " : ""}
                {stop.failureNotes ?? ""}
              </Text>
            ) : null}

            {lines.length > 0 ? (
              <View style={styles.lines}>
                {lines.map((line) => (
                  <View key={line.id} style={styles.line}>
                    <Text style={styles.lineName} numberOfLines={1}>
                      {line.description || codeLabel(line.itemType ?? "")}
                    </Text>
                    <Text style={styles.lineQty}>
                      {line.deliveredQuantity != null ? `${line.deliveredQuantity} / ` : ""}
                      {line.departureQuantity ?? line.quantity}
                    </Text>
                    {line.shortageReason ? <Badge label={codeLabel(line.shortageReason, "shortage")} tone="warning" /> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  num: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint(colors.accent, 0.3),
  },
  numText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  type: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  location: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  meta: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing(3), rowGap: spacing(1), marginTop: spacing(2) },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing(2) },
  lines: {
    marginTop: spacing(3),
    padding: spacing(3),
    gap: spacing(2),
    borderRadius: radius.sm,
    backgroundColor: colors.track,
  },
  line: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  lineName: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  lineQty: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
}));
