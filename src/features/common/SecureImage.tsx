import { Image } from "expo-image";
import { FileText } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { authorizedFetch, isProtectedFile, resolveFileUrl } from "@/api/client";
import { getAccessToken } from "@/auth/session";
import { colors, radius, themedStyles } from "@/theme/tokens";

export { resolveFileUrl };

function isProtected(url: string) {
  return isProtectedFile(url);
}

const webCache = new Map<string, Promise<string>>();

/** Web : une balise <img> ne peut pas envoyer le Bearer, on passe par une URL blob:. */
function useWebBlob(url: string, enabled: boolean) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending = webCache.get(url);
    if (!pending) {
      // Bearer + silent renewal and replay on 401 (expired token).
      pending = authorizedFetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.blob();
        })
        .then((b) => URL.createObjectURL(b));
      pending.catch(() => webCache.delete(url));
      webCache.set(url, pending);
    }
    pending.then(
      (s) => active && setSrc(s),
      () => active && setFailed(true)
    );
    return () => {
      active = false;
    };
  }, [url, enabled]);
  return { src, failed };
}

/** Image protégée par le jeton (photos de preuve, pièces d'incident, documents). */
export function SecureImage({
  url,
  mimeType,
  style,
  onPress,
}: {
  url: string;
  mimeType?: string | null;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const resolved = resolveFileUrl(url);
  const isImage = mimeType ? mimeType.startsWith("image/") : /\.(jpe?g|png|webp|gif)$/i.test(resolved) || !/\.pdf$/i.test(resolved);
  const web = Platform.OS === "web" && isProtected(resolved);
  const { src, failed } = useWebBlob(resolved, web && isImage);
  const token = getAccessToken();

  const content = !isImage || failed ? (
    <FileText size={26} color={colors.textMuted} />
  ) : web ? (
    src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ActivityIndicator color={colors.textMuted} />
  ) : (
    <Image
      source={{ uri: resolved, headers: isProtected(resolved) && token ? { Authorization: `Bearer ${token}` } : undefined }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={150}
    />
  );

  return (
    <Pressable onPress={onPress ?? (() => void openSecureFile(url))} style={[styles.tile, style]} accessibilityRole="imagebutton">
      <View style={styles.center}>{content}</View>
    </Pressable>
  );
}

/** Ouvre un fichier protégé : blob: sur le web, URL directe sinon (le navigateur système). */
export async function openSecureFile(url: string) {
  const resolved = resolveFileUrl(url);
  if (Platform.OS === "web" && isProtected(resolved)) {
    const res = await authorizedFetch(resolved).catch(() => null);
    if (!res?.ok) return;
    const blobUrl = URL.createObjectURL(await res.blob());
    window.open(blobUrl, "_blank");
    return;
  }
  await Linking.openURL(resolved).catch(() => undefined);
}

const styles = themedStyles(() => ({
  tile: {
    overflow: "hidden",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
}));
