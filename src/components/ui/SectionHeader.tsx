import { ArrowRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";

type Props = { title: string; actionLabel?: string; onAction?: () => void };

/** Section title with an optional "Voir tout →" action on the right. */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const label = actionLabel?.replace(/\s*[→>]+\s*$/, "");
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {label && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>{label}</Text>
          <ArrowRight size={15} color={colors.accentSoft} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing(6),
    marginBottom: spacing(3),
  },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.text },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accentSoft },
}));
