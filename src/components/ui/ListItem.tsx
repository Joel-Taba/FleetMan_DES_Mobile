import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { colors, fonts, tint, themedStyles } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
};

/**
 * Row with optional leading and trailing content (a chevron when pressable and no
 * `right`). Transparent: place rows inside a GlassCard, separated by <Divider />.
 */
export function ListItem({ title, subtitle, left, right, onPress }: Props) {
  const body = (
    <View style={styles.row}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {body}
    </Pressable>
  );
}

/** Small rounded container for a ListItem leading icon (`color` must be a hex color). */
export function ListIcon({ children, color = colors.accentSoft }: { children: ReactNode; color?: string }) {
  return <View style={[styles.iconBox, { borderColor: tint(color, 0.25) }]}>{children}</View>;
}

const styles = themedStyles(() => ({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  left: { alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.track,
    borderWidth: 1,
  },
}));
