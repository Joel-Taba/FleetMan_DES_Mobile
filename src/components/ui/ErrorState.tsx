import { AlertTriangle } from "lucide-react-native";
import { Text, View } from "react-native";

import { useT } from "@/i18n";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

import { PillButton } from "./PillButton";

/** Error message with an optional retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <View style={styles.root}>
      <View style={[styles.bubble, styles.dangerBubble]}>
        <AlertTriangle size={28} color={colors.danger} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>{t("Une erreur est survenue")}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <PillButton label={t("Réessayer")} variant="glass" onPress={onRetry} style={styles.retry} />
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { alignItems: "center", justifyContent: "center", paddingVertical: spacing(10), paddingHorizontal: spacing(6) },
  bubble: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(4),
  },
  dangerBubble: { backgroundColor: tint(colors.danger, 0.14), borderWidth: 1, borderColor: tint(colors.danger, 0.3) },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.text, textAlign: "center" },
  message: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing(2),
  },
  retry: { marginTop: spacing(5), minWidth: 160 },
}));
