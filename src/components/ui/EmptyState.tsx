import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

import { GlassView } from "./GlassView";

/** Placeholder for an empty list or section. */
export function EmptyState({ icon: Icon, title, message }: { icon: LucideIcon; title: string; message?: string }) {
  return (
    <View style={styles.root}>
      <GlassView style={styles.bubble}>
        <Icon size={28} color={colors.accentSoft} strokeWidth={1.8} />
      </GlassView>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { alignItems: "center", justifyContent: "center", paddingVertical: spacing(10), paddingHorizontal: spacing(6) },
  bubble: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(4),
  },
  dangerBubble: { backgroundColor: tint(colors.danger, 0.14), borderWidth: 1, borderColor: tint(colors.danger, 0.3) },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.text, textAlign: "center" },
  message: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing(2),
  },
  retry: { marginTop: spacing(5), minWidth: 160 },
}));
