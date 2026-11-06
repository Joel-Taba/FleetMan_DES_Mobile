import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts, radius, tint, themedStyles, themed } from "@/theme/tokens";

type Variant = "primary" | "glass" | "danger" | "ghost";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
};

const TEXT_COLOR: Record<Variant, string> = themed(() => ({
  primary: colors.ctaText,
  glass: colors.text,
  danger: colors.danger,
  ghost: colors.accentSoft,
}));

/** Pill-shaped button. `primary` = light sky gradient with navy text (main call to action). */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  iconPosition = "right",
  loading = false,
  disabled = false,
  size = "md",
  style,
}: Props) {
  const height = size === "lg" ? 56 : 48;
  const color = TEXT_COLOR[variant];
  const inactive = disabled || loading;

  const iconNode = Icon ? (
    variant === "primary" ? (
      <View style={[styles.iconBubble, { width: height - 16, height: height - 16 }]}>
        <Icon size={18} color={colors.text} strokeWidth={2.2} />
      </View>
    ) : (
      <Icon size={18} color={color} strokeWidth={2.2} />
    )
  ) : null;

  // A primary button keeps its label centered: the icon bubble sits at one edge and an
  // invisible spacer of the same width balances it on the other side.
  const bubble = !!Icon && variant === "primary";
  const spacer = bubble ? <View style={{ width: height - 16 }} /> : null;

  const content = (
    <View style={[styles.row, { height, paddingHorizontal: bubble ? 8 : 22 }]}>
      {iconPosition === "left" ? iconNode : spacer}
      {loading ? (
        <ActivityIndicator color={color} style={[styles.labelBox, bubble && styles.grow]} />
      ) : (
        <Text
          style={[styles.label, styles.labelBox, bubble && styles.grow, { color, fontSize: size === "lg" ? 16 : 15 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
      {iconPosition === "right" ? iconNode : spacer}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.base, { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[colors.ctaFrom, colors.ctaTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, VARIANT_STYLE[variant]]}>{content}</View>
      )}
    </Pressable>
  );
}

const VARIANT_STYLE: Record<Exclude<Variant, "primary">, ViewStyle> = themed(() => ({
  glass: { backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  danger: { backgroundColor: tint(colors.danger, 0.14), borderWidth: 1, borderColor: tint(colors.danger, 0.4) },
  ghost: { backgroundColor: "transparent" },
}));

const styles = themedStyles(() => ({
  base: { borderRadius: radius.pill, overflow: "hidden" },
  fill: { borderRadius: radius.pill },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  labelBox: { flexShrink: 1, paddingHorizontal: 6 },
  grow: { flexGrow: 1 },
  label: { fontFamily: fonts.bodySemibold, textAlign: "center" },
  iconBubble: {
    borderRadius: radius.pill,
    backgroundColor: colors.ctaText,
    alignItems: "center",
    justifyContent: "center",
  },
}));
