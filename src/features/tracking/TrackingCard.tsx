import { LocateFixed, LocateOff, MapPin, Settings } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";

import { GlassCard, PillButton } from "@/components/ui";
import { useT } from "@/i18n";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";
import { isTrackableTrip, useTripTracking } from "./useTripTracking";

/** « il y a 12 s » / « il y a 3 min » pour la ligne d'état. */
function sharedAgo(ms: number, t: (s: string) => string) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return t("Position partagée il y a {n} s").replace("{n}", String(seconds));
  return t("Position partagée il y a {n} min").replace("{n}", String(Math.floor(seconds / 60)));
}

/**
 * Partage de la position pendant la tournée (écran du trajet en cours) : carte d'explication au
 * premier trajet, puis une ligne d'état discrète (« Position partagée il y a 12 s », « Partage
 * désactivé », aide si la localisation est refusée).
 */
export function TrackingCard({ tripId, tripStatus }: { tripId: string; tripStatus: string }) {
  const { t } = useT();
  const { state, consent, blocked, busy, enable, disable } = useTripTracking(tripId, tripStatus);
  const [now, setNow] = useState(() => Date.now());
  const sharingThisTrip = state.tripId === tripId;

  // Âge de la dernière position rafraîchi toutes les 5 s.
  useEffect(() => {
    if (!sharingThisTrip) return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [sharingThisTrip]);

  if (!isTrackableTrip(tripStatus) || consent === null) return null;

  // Premier trajet : explication et choix du chauffeur, mémorisé ensuite.
  if (consent === "unset") {
    return (
      <GlassCard>
        <View style={styles.head}>
          <View style={styles.iconWrap}>
            <MapPin size={18} color={colors.accentSoft} />
          </View>
          <Text style={styles.title}>{t("Partager ma position pendant la tournée")}</Text>
        </View>
        <Text style={styles.body}>
          {t(
            "Votre gestionnaire voit où se trouve le véhicule pendant le trajet, pour suivre la tournée et vous aider en cas de problème."
          )}
        </Text>
        <Text style={styles.note}>
          {t(
            "La position est envoyée toutes les 30 secondes, seulement quand l'application est ouverte, et le partage s'arrête à la fin du trajet."
          )}
        </Text>
        <View style={styles.actions}>
          <PillButton label={t("Partager ma position")} icon={LocateFixed} iconPosition="left" loading={busy} onPress={() => void enable()} />
          <PillButton label={t("Plus tard")} variant="ghost" disabled={busy} onPress={() => void disable()} />
        </View>
      </GlassCard>
    );
  }

  if (consent === "declined" || (!sharingThisTrip && state.status === "idle")) {
    return (
      <StatusLine
        icon="off"
        text={t("Partage désactivé")}
        action={{ label: t("Activer le partage"), onPress: () => void enable() }}
        busy={busy}
      />
    );
  }

  if (sharingThisTrip && state.status === "denied") {
    return (
      <GlassCard>
        <View style={styles.head}>
          <LocateOff size={18} color={colors.warning} />
          <Text style={styles.title}>{t("Localisation refusée")}</Text>
        </View>
        <Text style={styles.body}>
          {blocked
            ? t("Autorisez la localisation pour FleetMan dans les réglages du téléphone pour partager votre position.")
            : t("Autorisez la localisation pour partager votre position pendant la tournée.")}
        </Text>
        <View style={styles.actions}>
          {blocked && Platform.OS !== "web" ? (
            <PillButton label={t("Ouvrir les réglages")} icon={Settings} iconPosition="left" variant="glass" onPress={() => void Linking.openSettings()} />
          ) : (
            <PillButton label={t("Autoriser la localisation")} icon={LocateFixed} iconPosition="left" loading={busy} onPress={() => void enable()} />
          )}
          <PillButton label={t("Ne pas partager")} variant="ghost" onPress={() => void disable()} />
        </View>
      </GlassCard>
    );
  }

  let text: string;
  let tone: "on" | "warn" | "off" = "on";
  if (state.status === "servicesOff") {
    text = t("Activez la localisation (GPS) du téléphone pour partager votre position.");
    tone = "warn";
  } else if (state.status === "paused") {
    text = t("Partage en pause : application en arrière-plan");
    tone = "off";
  } else if (state.lastFailedAt && (!state.lastSentAt || state.lastFailedAt > state.lastSentAt)) {
    text = t("Hors réseau : position non envoyée");
    tone = "warn";
  } else if (state.lastSentAt) {
    text = sharedAgo(now - state.lastSentAt, t);
  } else {
    text = t("Recherche de la position…");
  }
  return (
    <StatusLine
      icon={tone}
      text={text}
      action={{ label: t("Arrêter"), onPress: () => void disable() }}
      busy={busy}
    />
  );
}

function StatusLine({
  icon,
  text,
  action,
  busy,
}: {
  icon: "on" | "warn" | "off";
  text: string;
  action: { label: string; onPress: () => void };
  busy: boolean;
}) {
  const color = icon === "on" ? colors.success : icon === "warn" ? colors.warning : colors.textMuted;
  const Icon = icon === "off" ? LocateOff : LocateFixed;
  return (
    <View style={[styles.line, { backgroundColor: tint(color, 0.08), borderColor: tint(color, 0.22) }]}>
      <Icon size={16} color={color} />
      <Text style={styles.lineText} numberOfLines={2}>
        {text}
      </Text>
      <Pressable
        onPress={action.onPress}
        disabled={busy}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.lineAction, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.lineActionText}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  head: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint(colors.accent, 0.12),
  },
  title: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: spacing(3) },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: spacing(2) },
  actions: { gap: spacing(2), marginTop: spacing(4) },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
    borderWidth: 1,
  },
  lineText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  lineAction: { paddingHorizontal: spacing(1) },
  lineActionText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accentSoft },
}));
