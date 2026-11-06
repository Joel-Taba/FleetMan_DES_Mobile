import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";

import { authorizedFetch, isProtectedFile, resolveFileUrl } from "@/api/client";
import { getAccessToken } from "@/auth/session";
import { colors, fonts, themedStyles } from "@/theme/tokens";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

type Source = { uri: string; headers?: Record<string, string> } | null;

/**
 * Image source of a profile photo. Files under /api/v1/files/ need the Bearer token:
 * native sends it as a header, web downloads the file and shows a blob: URL.
 */
function usePhotoSource(photoUrl?: string): Source {
  const protectedFile = isProtectedFile(photoUrl);
  const [webBlob, setWebBlob] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl || !protectedFile || Platform.OS !== "web") return;
    let cancelled = false;
    let objectUrl: string | null = null;
    // Bearer + silent renewal and replay on 401 (expired token).
    authorizedFetch(resolveFileUrl(photoUrl))
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setWebBlob(objectUrl);
      })
      .catch(() => !cancelled && setWebBlob(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl, protectedFile]);

  if (!photoUrl) return null;
  if (!protectedFile) return { uri: resolveFileUrl(photoUrl) };
  if (Platform.OS === "web") return webBlob ? { uri: webBlob } : null;
  const token = getAccessToken();
  return { uri: resolveFileUrl(photoUrl), headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}

/** Round profile photo, or initials on the accent gradient when there is none. */
export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string; size?: number }) {
  const source = usePhotoSource(photoUrl);
  // Remembers which URL failed, so a new photo URL is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !!photoUrl && failedUrl === photoUrl;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (source && !failed) {
    return (
      <View style={[styles.ring, shape]}>
        <Image
          source={source}
          style={shape}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUrl(photoUrl ?? null)}
          accessibilityLabel={name}
        />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={[colors.ctaFrom, colors.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, styles.center, shape]}
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>{initials(name)}</Text>
    </LinearGradient>
  );
}

const styles = themedStyles(() => ({
  ring: { overflow: "hidden", borderWidth: 1.5, borderColor: colors.trackStrong },
  center: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fonts.displayBold, color: colors.ctaText },
}));
