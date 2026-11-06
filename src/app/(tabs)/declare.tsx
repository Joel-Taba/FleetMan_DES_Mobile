import { router, useFocusEffect, type Href } from "expo-router";
import { AlertTriangle, ChevronRight, ClipboardList, Fuel, ReceiptText, Wrench, type LucideIcon } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { fetchMyIncidents } from "@/api/driver";
import type { IncidentResponse } from "@/api/types";
import { AppHeader, Badge, EmptyState, GlassCard, LicensePlate, LoadingState, Screen, SectionHeader } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useT } from "@/i18n";
import { formatDate, formatDateTime } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { incidentTone } from "@/features/declare/labels";
import { useDeclarationHistory } from "@/features/declare/recent";
import { useDriverId } from "@/features/driver/hooks";
import { colors, fonts, radius, spacing, tint, themedStyles, themed } from "@/theme/tokens";

const ACTIONS: { key: string; href: Href; label: string; hint: string; icon: LucideIcon; color: string }[] = [
  {
    key: "incident",
    href: { pathname: "/declare/[kind]", params: { kind: "incident" } },
    label: "Signaler un Incident",
    hint: "Accident, panne, vol, vandalisme…",
    icon: AlertTriangle,
    get color() {
      return colors.danger;
    },
  },
  {
    key: "fuel",
    href: { pathname: "/declare/[kind]", params: { kind: "fuel" } },
    label: "Déclarer un Plein",
    hint: "Litres, montant, station",
    icon: Fuel,
    get color() {
      return colors.accentSoft;
    },
  },
  {
    key: "maintenance",
    href: { pathname: "/declare/[kind]", params: { kind: "maintenance" } },
    label: "Signaler Maintenance",
    hint: "Préventive, corrective, urgence",
    icon: Wrench,
    get color() {
      return colors.warning;
    },
  },
  {
    key: "expense",
    href: "/declare/expense",
    label: "Déclarer une dépense (péage, amende)",
    hint: "Montant, justificatif, validation du gestionnaire",
    icon: ReceiptText,
    get color() {
      return colors.success;
    },
  },
];

const KIND_ICON: Record<string, LucideIcon> = { fuel: Fuel, maintenance: Wrench, expense: ReceiptText };
const KIND_COLOR: Record<string, string> = themed(() => ({ fuel: colors.accentSoft, maintenance: colors.warning, expense: colors.success }));

/** Déclarations terrain (DriverDeclarations du web) : incident, plein, maintenance, dépense ; suivi de mes incidents. */
export default function DeclareScreen() {
  const { t } = useT();
  const driverId = useDriverId();
  const incidents = useApiQuery<IncidentResponse[]>(`driver:incidents:${driverId}`, fetchMyIncidents, [driverId], { enabled: Boolean(driverId) });
  const recent = useDeclarationHistory(driverId);

  // Retour d'un formulaire : la liste locale et les incidents sont relus.
  useFocusEffect(
    useCallback(() => {
      void recent.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recent.reload])
  );

  const list = [...(incidents.data ?? [])].sort((a, b) => (b.incidentDateTime ?? "").localeCompare(a.incidentDateTime ?? ""));

  return (
    <Screen
      withTabBar
      header={<AppHeader title={t("Déclarations terrain")} />}
      refreshing={incidents.refreshing || recent.refreshing}
      onRefresh={() => {
        void incidents.refetch();
        void recent.reload();
      }}
    >
      <View style={styles.stack}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => router.push(a.href)}
            style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }}
          >
            <GlassCard>
              <View style={styles.row}>
                <View style={[styles.tile, { backgroundColor: tint(a.color, 0.18) }]}>
                  <a.icon size={26} color={a.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{t(a.label)}</Text>
                  <Text style={styles.sub}>{t(a.hint)}</Text>
                </View>
                <View style={styles.arrow}>
                  <ChevronRight size={18} color={colors.ctaText} />
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ))}

        <SectionHeader title={t("Mes incidents")} />
        {incidents.loading && !incidents.data ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState icon={AlertTriangle} title={t("Aucun incident déclaré.")} />
        ) : (
          <View style={{ gap: spacing(3) }}>
            {list.map((inc) => (
              <GlassCard key={inc.id} onPress={() => router.push({ pathname: "/incident/[id]", params: { id: inc.id } })}>
                <View style={styles.row}>
                  <View style={[styles.tileSm, inc.isCritical && { backgroundColor: tint(colors.danger, 0.2) }]}>
                    <AlertTriangle size={20} color={inc.isCritical ? colors.danger : colors.warning} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{codeLabel(inc.type)}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {formatDate(inc.incidentDateTime)} · {codeLabel(inc.severity)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: spacing(2) }}>
                    <Badge label={codeLabel(inc.status)} tone={incidentTone(inc.status)} />
                    {inc.vehicleRegistration ? <LicensePlate plate={inc.vehicleRegistration} size="sm" /> : null}
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        <SectionHeader title={t("Mes déclarations récentes")} />
        {recent.fromServer ? (
          recent.items.length === 0 ? (
            <GlassCard>
              <Text style={styles.sub}>{t("Aucune déclaration de plein, de maintenance ou de dépense pour le moment.")}</Text>
            </GlassCard>
          ) : (
            <View style={{ gap: spacing(3) }}>
              {recent.items.map((item) => {
                const Icon = KIND_ICON[item.kind] ?? ClipboardList;
                const color = KIND_COLOR[item.kind] ?? colors.textMuted;
                return (
                  <GlassCard key={item.key}>
                    <View style={styles.row}>
                      <View style={[styles.tileSm, { backgroundColor: tint(color, 0.16) }]}>
                        <Icon size={20} color={color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.recentLabel}>{item.title}</Text>
                        <Text style={styles.sub} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      <Badge label={item.statusLabel} tone={item.tone} />
                    </View>
                    {item.details.length > 0 ? (
                      <View style={styles.details}>
                        {item.details.map((d) => (
                          <Text key={d} style={styles.detail}>{d}</Text>
                        ))}
                      </View>
                    ) : null}
                  </GlassCard>
                );
              })}
            </View>
          )
        ) : recent.loading ? (
          <LoadingState />
        ) : recent.local.length === 0 ? (
          <GlassCard>
            <Text style={styles.sub}>{t("Les déclarations apparaîtront ici après enregistrement ou synchronisation.")}</Text>
          </GlassCard>
        ) : (
          <GlassCard padding={4}>
            {recent.local.map((item, i) => (
              <View key={`${item.kind}-${item.id}`} style={[styles.recent, i > 0 && styles.recentBorder]}>
                <ClipboardList size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentLabel}>{item.label}</Text>
                  <Text style={styles.sub}>{formatDateTime(item.at)}</Text>
                </View>
                <Badge label={codeLabel(item.status)} tone={item.status === "ENREGISTRÉ" ? "default" : "warning"} />
              </View>
            ))}
          </GlassCard>
        )}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  tile: { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tileSm: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint(colors.warning, 0.15),
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ctaFrom,
  },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  recent: { flexDirection: "row", alignItems: "center", gap: spacing(3), padding: spacing(3) },
  recentBorder: { borderTopWidth: 1, borderTopColor: colors.glassBorder },
  details: { marginTop: spacing(2), paddingLeft: 44 + spacing(3), gap: 2 },
  detail: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  recentLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
}));
