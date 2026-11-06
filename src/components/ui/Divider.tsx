import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, themedStyles } from "@/theme/tokens";

/** Thin horizontal separator. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  return <View style={[styles.line, style]} />;
}

const styles = themedStyles(() => ({
  line: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.glassBorder, alignSelf: "stretch" },
}));
