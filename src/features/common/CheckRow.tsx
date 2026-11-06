import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors, fonts, radius, spacing, themedStyles } from "@/theme/tokens";

/** Case à cocher pleine largeur, avec une précision facultative. */
export function CheckRow({
  checked,
  onChange,
  title,
  subtitle,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, checked && styles.rowChecked, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={14} color={colors.ctaText} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(3),
    padding: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  rowChecked: { borderColor: colors.accentSoft },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: { backgroundColor: colors.ctaFrom, borderColor: colors.ctaFrom },
  title: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
}));
