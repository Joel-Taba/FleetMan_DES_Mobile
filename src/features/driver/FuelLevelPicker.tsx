import { Pressable, Text, View } from "react-native";
import { colors, fonts, radius, spacing, themedStyles } from "@/theme/tokens";

const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Niveau de carburant par pas de 10 % (remplace le curseur du web). */
export function FuelLevelPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const color = value <= 20 ? colors.danger : value <= 40 ? colors.warning : colors.success;
  return (
    <View style={{ gap: spacing(2) }}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{value}%</Text>
      </View>
      <View style={styles.bar}>
        {STEPS.slice(1).map((step) => (
          <Pressable
            key={step}
            accessibilityRole="adjustable"
            accessibilityLabel={`${step}%`}
            onPress={() => onChange(step === value ? step - 10 : step)}
            style={[styles.seg, step <= value && { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  value: { fontFamily: fonts.displayBold, fontSize: 18 },
  bar: { flexDirection: "row", gap: 4, height: 30 },
  seg: { flex: 1, borderRadius: radius.sm / 2, backgroundColor: colors.track },
}));
