import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, themedStyles } from "@/theme/tokens";

import { ScreenBackground } from "./ScreenBackground";

/** Height reserved for the floating tab bar (bar + margin), added to the bottom inset. */
export const TAB_BAR_SPACE = 104;

type Props = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactNode;
  padded?: boolean;
  withTabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Screen shell: gradient background, safe areas, optional fixed header and pull-to-refresh. */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  header,
  padded = true,
  withTabBar = false,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottom = (withTabBar ? TAB_BAR_SPACE : spacing(6)) + insets.bottom;
  const content = [padded && styles.padded, { paddingBottom: bottom }, contentStyle];

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <View style={{ paddingTop: insets.top }}>{header}</View>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, content]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accentSoft}
                colors={[colors.accent]}
                progressBackgroundColor={colors.bgMid}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, content]}>{children}</View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing(4), paddingTop: spacing(2) },
}));
