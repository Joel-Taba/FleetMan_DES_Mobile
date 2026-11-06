import { Minus, Plus, type LucideIcon } from "lucide-react-native";
import { Pressable, Text } from "react-native";

import { useT } from "@/i18n";
import { colors, fonts, radius, themedStyles } from "@/theme/tokens";

import { GlassView } from "./GlassView";

type Props = { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number };

function StepButton({ icon: Icon, onPress, disabled, label }: { icon: LucideIcon; onPress: () => void; disabled: boolean; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Icon size={16} color={colors.text} strokeWidth={2.4} />
    </Pressable>
  );
}

/** Quantity stepper: minus / value / plus in a glass pill. */
export function Stepper({ value, onChange, min = 0, max, step = 1 }: Props) {
  const { t } = useT();
  const canDec = value - step >= min;
  const canInc = max == null || value + step <= max;
  return (
    <GlassView style={styles.pill}>
      <StepButton icon={Minus} label={t("Diminuer")} disabled={!canDec} onPress={() => onChange(value - step)} />
      <Text style={styles.value} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <StepButton icon={Plus} label={t("Augmenter")} disabled={!canInc} onPress={() => onChange(value + step)} />
    </GlassView>
  );
}

const styles = themedStyles(() => ({
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: radius.pill, padding: 4, gap: 4 },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.track,
  },
  value: { minWidth: 30, textAlign: "center", fontFamily: fonts.displayBold, fontSize: 16, color: colors.text },
}));
