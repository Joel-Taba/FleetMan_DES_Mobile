import { Pressable, Text, View } from "react-native";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

export type Choice<T extends string> = { value: T; label: string };

/** Sélecteur à pastilles (remplace les <select> du web) : une seule valeur active. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "accent",
}: {
  label?: string;
  options: readonly Choice<T>[];
  value: T | "";
  onChange: (value: T) => void;
  tone?: "accent" | "danger" | "warning";
}) {
  const activeColor = tone === "danger" ? colors.danger : tone === "warning" ? colors.warning : colors.accentSoft;
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.chip,
                active && { backgroundColor: tint(activeColor, 0.22), borderColor: activeColor },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.chipText, active && { color: colors.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: spacing(2) },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  chip: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
}));
