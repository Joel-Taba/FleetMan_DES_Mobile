import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useColorScheme } from "@/theme/scheme";
import { colors, themedStyles } from "@/theme/tokens";

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  /**
   * Real backdrop blur (iOS and web). Android renders the translucent fill only, which
   * looks the same over the blurred background and avoids the cost of a native blur.
   */
  blur?: boolean;
  intensity?: number;
};

const canBlur = Platform.OS === "ios" || Platform.OS === "web";

/** Surface vitrée : fond blanc (ou marine en sombre), fine bordure, flou optionnel. */
export function GlassView({ children, style, strong = false, blur = false, intensity = 30 }: Props) {
  const scheme = useColorScheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: strong ? colors.glassStrong : colors.glass },
        blur && Platform.OS === "web" && styles.webStackingContext,
        style,
      ]}
    >
      {blur && canBlur ? (
        <BlurView tint={scheme === "dark" ? "dark" : "light"} intensity={intensity} style={[StyleSheet.absoluteFill, Platform.OS === "web" && styles.webBehind]} />
      ) : null}
      {children}
    </View>
  );
}

const styles = themedStyles(() => ({
  base: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.glassBorder,
  },
  // On web an absolutely positioned layer paints over non-positioned siblings such as
  // <svg> icons: keep the blur layer behind the content inside its own stacking context.
  webStackingContext: { zIndex: 0 },
  webBehind: { zIndex: -1 },
}));
