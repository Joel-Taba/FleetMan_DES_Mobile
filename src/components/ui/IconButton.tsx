import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors, fonts, themedStyles } from "@/theme/tokens";

import { GlassView } from "./GlassView";

type Props = {
  icon: LucideIcon;
  onPress?: () => void;
  badge?: number;
  accessibilityLabel: string;
  size?: number;
};

/** Round glass icon button with an optional red counter badge. */
export function IconButton({ icon: Icon, onPress, badge, accessibilityLabel, size = 44 }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <GlassView blur style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon size={Math.round(size * 0.45)} color={colors.text} strokeWidth={2} />
      </GlassView>
      {badge != null && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  circle: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bgMid,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontFamily: fonts.bodySemibold, fontSize: 10, lineHeight: 12 },
}));
