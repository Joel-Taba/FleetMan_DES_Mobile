import type { LucideIcon } from "lucide-react-native";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, themedStyles } from "@/theme/tokens";

import { GlassView } from "./GlassView";

type Item = { icon: LucideIcon; label: string; value: string };

/** Row of key figures separated by thin vertical dividers. */
export function StatRow({ items }: { items: Item[] }) {
  return (
    <GlassView style={styles.card}>
      {items.map(({ icon: Icon, label, value }, index) => (
        <Fragment key={`${label}-${index}`}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.item}>
            <Icon size={18} color={colors.accentSoft} strokeWidth={2} />
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {value}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </Fragment>
      ))}
    </GlassView>
  );
}

const styles = themedStyles(() => ({
  card: { flexDirection: "row", alignItems: "stretch", borderRadius: radius.lg, paddingVertical: 14 },
  item: { flex: 1, alignItems: "center", paddingHorizontal: 6, gap: 4 },
  divider: { width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.glassBorder, marginVertical: 4 },
  value: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 21, color: colors.text, marginTop: 2 },
  label: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 15, color: colors.textMuted },
}));
