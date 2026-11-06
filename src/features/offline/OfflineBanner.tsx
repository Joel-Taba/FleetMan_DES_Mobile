import { router } from "expo-router";
import { ChevronRight, CloudOff, RefreshCw, AlertTriangle } from "lucide-react-native";
import { useEffect, useMemo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/hooks/useOnline";
import { useT } from "@/i18n";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

import { useOfflineQueue } from "./hooks";
import { startOfflineSync } from "./sync";

/** "{n}" in a translated text replaced by a number. */
export function withCount(text: string, n: number): string {
  return text.replace("{n}", String(n));
}

/**
 * App-wide frame of the offline queue: starts the automatic replay and shows a discreet banner
 * above the screens while actions wait or were refused (tap: /sync). When it shows, the banner
 * takes the top safe-area inset and the screens below get 0, so nothing is padded twice.
 */
export function OfflineFrame({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  // Mounted for the whole session: keeps the health ping that notices the network coming back.
  const online = useOnline();
  const { pending, failed, syncing } = useOfflineQueue();

  useEffect(() => startOfflineSync(), []);

  const visible = enabled && (pending.length > 0 || failed.length > 0 || syncing);
  const childInsets = useMemo(() => (visible ? { ...insets, top: 0 } : insets), [visible, insets]);

  let tone: string = colors.warning;
  let Icon = CloudOff;
  const parts: string[] = [];
  if (syncing) {
    tone = colors.accentSoft;
    Icon = RefreshCw;
    parts.push(t("Synchronisation…"));
  } else if (pending.length > 0) {
    parts.push(
      withCount(online ? t("{n} action(s) en attente d'envoi") : t("Hors ligne : {n} action(s) en attente"), pending.length)
    );
  }
  if (!syncing && failed.length > 0) {
    if (pending.length === 0) {
      tone = colors.danger;
      Icon = AlertTriangle;
    }
    parts.push(withCount(t("{n} action(s) refusée(s)"), failed.length));
  }

  return (
    <View style={styles.root}>
      {visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${parts.join(" · ")}. ${t("Voir les actions hors ligne")}`}
          onPress={() => router.push("/sync")}
          style={({ pressed }) => [styles.banner, { paddingTop: insets.top + spacing(2), opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.fill, { backgroundColor: tint(tone, 0.12), borderBottomColor: tint(tone, 0.3) }]} />
          <Icon size={16} color={tone} />
          <Text style={[styles.text, { color: tone }]} numberOfLines={1}>
            {parts.join(" · ")}
          </Text>
          <ChevronRight size={16} color={tone} />
        </Pressable>
      ) : null}
      <SafeAreaInsetsContext.Provider value={childInsets}>
        <View style={styles.root}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
    backgroundColor: colors.glassStrong,
  },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderBottomWidth: 1 },
  text: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13 },
}));
