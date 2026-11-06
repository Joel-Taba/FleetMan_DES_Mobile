import { Image } from "expo-image";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { PickedFile } from "@/api/driver";
import { PillButton } from "@/components/ui";
import { useT } from "@/i18n";
import { colors, fonts, radius, spacing, themedStyles } from "@/theme/tokens";
import { pickFromLibrary, takePhoto } from "./media";

/**
 * Choix d'une photo : appareil photo ou galerie (une seule source sur le web, où le
 * navigateur propose lui-même la caméra). `onPicked` reçoit le fichier choisi.
 */
export function PhotoPickerRow({
  preview,
  label,
  busy,
  onPicked,
  onClear,
  onError,
}: {
  preview?: string | null;
  label?: string;
  busy?: boolean;
  onPicked: (file: PickedFile) => void;
  onClear?: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useT();

  async function run(source: "camera" | "library") {
    try {
      const file = source === "camera" ? await takePhoto() : await pickFromLibrary();
      if (file) onPicked(file);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("Action impossible."));
    }
  }

  return (
    <View style={{ gap: spacing(2) }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {preview ? (
        <View style={styles.preview}>
          <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {onClear ? (
            <Pressable accessibilityLabel={t("Retirer")} style={styles.clear} onPress={onClear}>
              <X size={16} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.row}>
        {Platform.OS !== "web" ? (
          <PillButton
            label={t("Prendre une photo")}
            icon={Camera}
            iconPosition="left"
            variant="glass"
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() => void run("camera")}
          />
        ) : null}
        <PillButton
          label={Platform.OS === "web" ? t("Joindre une photo") : t("Galerie")}
          icon={ImagePlus}
          iconPosition="left"
          variant="glass"
          loading={busy}
          disabled={busy}
          style={{ flex: 1 }}
          onPress={() => void run("library")}
        />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  row: { flexDirection: "row", gap: spacing(2) },
  preview: {
    height: 160,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  clear: {
    position: "absolute",
    top: spacing(2),
    right: spacing(2),
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
}));
