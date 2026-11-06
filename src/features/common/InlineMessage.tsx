import { AlertCircle, CheckCircle2, Info } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, tint } from "@/theme/tokens";

/** Message d'erreur, de succès ou d'information (texte du serveur affiché tel quel). */
export function InlineMessage({ text, tone = "danger" }: { text: string | null | undefined; tone?: "danger" | "success" | "warning" | "info" }) {
  if (!text) return null;
  const color =
    tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "info" ? colors.accentSoft : colors.danger;
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <View
      accessibilityRole={tone === "danger" ? "alert" : undefined}
      style={[styles.box, { backgroundColor: tint(color, 0.12), borderColor: tint(color, 0.4) }]}
    >
      <Icon size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: spacing(2),
    alignItems: "flex-start",
    padding: spacing(3),
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  text: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
});
