import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text } from "react-native";

import { colors, fonts, radius, themedStyles } from "@/theme/tokens";

import { GlassView } from "./GlassView";

type Props = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onPress?: () => void;
};

/** Quick action / category chip: square glass tile with the label underneath. */
export function IconChip({ icon: Icon, label, active = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.root, { opacity: pressed ? 0.7 : 1 }]}
    >
      <GlassView
        style={[
          styles.tile,
          active && { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        <Icon size={24} color={active ? colors.onAccent : colors.accentSoft} strokeWidth={1.9} />
      </GlassView>
      <Text style={[styles.label, active && { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  root: { alignItems: "center", width: 76 },
  tile: {
    width: 62,
    height: 62,
    borderRadius: radius.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
}));
