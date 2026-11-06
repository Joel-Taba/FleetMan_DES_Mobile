import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Car, ClipboardList, House, Route, UserRound, type LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassView } from "@/components/ui/GlassView";
import { useUnreadNotificationCount } from "@/features/notifications/store";
import { useT } from "@/i18n";
import { colors, fonts, radius, tint, themedStyles } from "@/theme/tokens";

/** Tabs of the driver app, in display order (route name -> icon and French label). */
export const DRIVER_TABS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: "index", label: "Accueil", icon: House },
  { name: "trips", label: "Trajets", icon: Route },
  { name: "vehicle", label: "Véhicule", icon: Car },
  { name: "declare", label: "Déclarer", icon: ClipboardList },
  { name: "profile", label: "Profil", icon: UserRound },
];

/** Floating frosted tab bar; the active tab sits in a soft circular highlight. */
export function GlassTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  // Notifications non lues : pastille sur l'accueil, où se trouve la cloche.
  const unread = useUnreadNotificationCount();

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <GlassView blur intensity={45} style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = DRIVER_TABS.find((item) => item.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          const Icon = tab.icon;
          const label = t(tab.label);

          const onPress = () => {
            const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}
            >
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <Icon size={21} color={focused ? colors.text : colors.textSecondary} strokeWidth={focused ? 2.3 : 1.9} />
                {tab.name === "index" && unread > 0 ? (
                  <View style={styles.badge} accessibilityLabel={`${unread} ${t("non lue(s)")}`}>
                    <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </GlassView>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { position: "absolute", left: 14, right: 14, alignItems: "stretch" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: radius.xl,
    backgroundColor: colors.barGlass,
    borderColor: colors.glassBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: { flex: 1, alignItems: "center", gap: 2 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  iconCircleActive: {
    backgroundColor: tint(colors.accent, 0.32),
    borderWidth: 1,
    borderColor: tint(colors.accentSoft, 0.35),
  },
  badge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.glassStrong,
  },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 9.5, lineHeight: 12, color: "#fff" },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10.5, lineHeight: 13, color: colors.textMuted },
  labelActive: { color: colors.accentSoft, fontFamily: fonts.bodySemibold },
}));
