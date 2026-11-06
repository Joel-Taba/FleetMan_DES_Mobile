import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { cardShadow, radius } from "@/theme/tokens";

import { GlassView } from "./GlassView";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  strong?: boolean;
  onPress?: () => void;
};

/** Rounded frosted card (radius 24). Pressable when `onPress` is given. */
export function GlassCard({ children, style, padding = 16, strong = false, onPress }: Props) {
  const card = (
    <GlassView strong={strong} style={[{ borderRadius: radius.lg, padding }, cardShadow, style]}>
      {children}
    </GlassView>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {card}
    </Pressable>
  );
}
