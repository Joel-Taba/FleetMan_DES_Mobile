import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, tint, themed } from "@/theme/tokens";

export type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

const TONES: Record<BadgeTone, { fg: string; bg: string; border: string }> = themed(() => ({
  default: { fg: colors.accentSoft, bg: tint(colors.accent, 0.18), border: tint(colors.accent, 0.35) },
  success: { fg: colors.success, bg: tint(colors.success, 0.14), border: tint(colors.success, 0.32) },
  warning: { fg: colors.warning, bg: tint(colors.warning, 0.14), border: tint(colors.warning, 0.32) },
  danger: { fg: colors.danger, bg: tint(colors.danger, 0.14), border: tint(colors.danger, 0.32) },
  muted: { fg: colors.textSecondary, bg: colors.track, border: colors.trackStrong },
}));

/** Small tinted status pill. */
export function Badge({ label, tone = "default" }: { label: string; tone?: BadgeTone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16 },
});
