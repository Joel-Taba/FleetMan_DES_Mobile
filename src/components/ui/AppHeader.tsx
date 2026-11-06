import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useT } from "@/i18n";
import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";

import { IconButton } from "./IconButton";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

/** Centered title with a round glass back button on the left and an optional right slot. */
export function AppHeader({ title, subtitle, onBack, right }: Props) {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel={t("Retour")} /> : null}
      </View>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    paddingBottom: spacing(3),
    minHeight: 60,
  },
  side: { minWidth: 44, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end", gap: spacing(2) },
  center: { flex: 1, alignItems: "center", paddingHorizontal: spacing(2) },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: 1 },
}));
