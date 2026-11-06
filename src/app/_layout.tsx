import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { useOnboarded } from "@/features/onboarding/gate";
import { OfflineFrame } from "@/features/offline/OfflineBanner";
import { useTrackingAutostart } from "@/features/tracking/autostart";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { colors } from "@/theme/tokens";

// Keeps the native splash (navy, FleetMan logo) until fonts, language and session are ready.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 300, fade: true });

function RootNavigator() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const signedIn = !!user;
  // Partage de position repris dès le lancement si une tournée est en cours et que le chauffeur l'a accepté.
  useTrackingAutostart();

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Safety net for routes not declared below: without a session, everything but /login
  // redirects to the login screen (declared routes are already guarded by Stack.Protected).
  useEffect(() => {
    if (!ready) return;
    // Écrans accessibles sans session : connexion et récupération du mot de passe.
    const onLogin = ["login", "forgot-password", "reset-password", "register", "activate"].includes((segments[0] as string | undefined) ?? "");
    if (!signedIn && !onLogin) router.replace("/login");
  }, [ready, signedIn, segments, router]);

  // Inscription à finaliser : seuls l'écran de finalisation et le dépôt de pièces sont ouverts.
  const onboarded = useOnboarded(user?.id);
  useEffect(() => {
    if (!ready || !signedIn || onboarded === null) return;
    const first = (segments[0] as string | undefined) ?? "";
    if (!onboarded && first !== "onboarding" && first !== "document-upload") router.replace("/onboarding");
    else if (onboarded && first === "onboarding") router.replace("/(tabs)");
  }, [ready, signedIn, onboarded, segments, router]);

  if (!ready) return null;

  // Offline queue banner on every signed-in screen except the queue screen itself.
  const onSync = (segments[0] as string | undefined) === "sync";

  return (
    <OfflineFrame enabled={signedIn && !onSync}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.bgBottom },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="trip/active" />
          <Stack.Screen name="trip/[id]" />
          <Stack.Screen name="assignments" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="documents" />
          <Stack.Screen name="document-upload" />
          <Stack.Screen name="declare/[kind]" />
          <Stack.Screen name="incident/[id]" />
          <Stack.Screen name="sync" />
          <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ animation: "fade" }} />
        </Stack.Protected>
      </Stack>
    </OfflineFrame>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.bgBottom }}>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
