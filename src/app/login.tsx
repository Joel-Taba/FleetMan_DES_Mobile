import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, ArrowRight, Info, LockKeyhole, UserRound } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { consumeInvalidationNotice } from "@/auth/session";
import { GlassView, Logo, PillButton, ScreenBackground, TextField } from "@/components/ui";
import { LANGUAGES, useT } from "@/i18n";
import { cardShadow, colors, fonts, radius, spacing, tint, type, themedStyles } from "@/theme/tokens";

const HERO = require("../../assets/images/login-hero.jpg");

function LanguageSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <GlassView blur style={styles.langSwitch}>
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <Pressable
            key={l.code}
            onPress={() => setLang(l.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t("Langue")} : ${l.label}`}
            style={[styles.langItem, active && styles.langItemActive]}
          >
            <Text style={[styles.langText, active && styles.langTextActive]}>{l.short}</Text>
          </Pressable>
        );
      })}
    </GlassView>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice] = useState(consumeInvalidationNotice);

  function errorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 0) {
        return `${t("Connexion au serveur impossible.")} ${t("Vérifiez votre connexion internet et réessayez.")}`;
      }
      if (e.code === "AUTH_006" || e.status === 502 || e.status === 503 || e.status === 504) {
        return t("Le service d'authentification est momentanément indisponible. Réessayez dans quelques instants.");
      }
      if (e.code === "DRIVER_ONLY") return e.message;
      if (e.code === "AUTH_001" || e.status === 401) return t("Identifiants ou mot de passe incorrects.");
      return e.message;
    }
    return t("Une erreur est survenue");
  }

  async function onSubmit() {
    if (!identifier.trim() || !password) {
      setError(t("Saisissez votre nom d'utilisateur et votre mot de passe."));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <View style={styles.heroWrap} pointerEvents="none">
        <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={3} />
        <LinearGradient
          colors={["rgba(228,240,250,0.55)", "rgba(241,246,251,0.78)", "rgba(246,248,251,0.96)", colors.bgBottom]}
          locations={[0, 0.42, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing(3), paddingBottom: insets.bottom + spacing(6) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <LanguageSwitch />
          </View>

          <View style={styles.hero}>
            <GlassView blur strong style={styles.logoTile}>
              <Logo size={84} color={colors.accentSoft} />
            </GlassView>
            <Text style={styles.brand}>FleetMan</Text>
            <Text style={styles.tagline}>{t("Votre espace chauffeur")}</Text>
            <Text style={styles.heroText}>
              {t("Vos trajets, votre véhicule et vos déclarations, partout sur la route.")}
            </Text>
          </View>

          <GlassView blur strong intensity={40} style={styles.card}>
            <Text style={styles.cardTitle}>{t("Connexion")}</Text>
            <Text style={styles.cardSubtitle}>{t("Utilisez les identifiants fournis par votre gestionnaire de flotte.")}</Text>

            {notice && !error ? (
              <View style={[styles.message, styles.info]}>
                <Info size={16} color={colors.accentSoft} />
                <Text style={[styles.messageText, { color: colors.accentSoft }]}>{notice}</Text>
              </View>
            ) : null}

            <View style={styles.fields}>
              <TextField
                label={t("Nom d'utilisateur")}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder={t("ex. jean.dupont")}
                icon={UserRound}
                autoCapitalize="none"
              />
              <TextField
                label={t("Mot de passe")}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••"
                icon={LockKeyhole}
                secureTextEntry
              />
              <Pressable
                onPress={() => router.push("/forgot-password")}
                accessibilityRole="link"
                hitSlop={8}
                style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.forgotText}>{t("Mot de passe oublié ?")}</Text>
              </Pressable>
            </View>

            {error ? (
              <View style={[styles.message, styles.error]} accessibilityLiveRegion="polite">
                <AlertTriangle size={16} color={colors.danger} />
                <Text style={[styles.messageText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            <PillButton
              label={t("Se connecter")}
              icon={ArrowRight}
              size="lg"
              loading={submitting}
              onPress={onSubmit}
              style={styles.submit}
            />
          </GlassView>

          <View style={styles.newDriver}>
            <Text style={styles.newDriverTitle}>{t("Nouveau chauffeur ?")}</Text>
            <View style={styles.newDriverActions}>
              <PillButton label={t("Créer mon compte")} variant="glass" onPress={() => router.push("/register")} />
              <PillButton label={t("J'ai un code d'activation")} variant="ghost" onPress={() => router.push("/activate")} />
            </View>
          </View>

          <Text style={styles.footer}>{t("Application réservée aux chauffeurs FleetMan.")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  flex: { flex: 1 },
  heroWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" },
  scroll: { flexGrow: 1, paddingHorizontal: spacing(5), justifyContent: "space-between" },
  topBar: { flexDirection: "row", justifyContent: "flex-end" },
  langSwitch: { flexDirection: "row", borderRadius: radius.pill, padding: 3, gap: 2 },
  langItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  langItemActive: { backgroundColor: tint(colors.accent, 0.45) },
  langText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary },
  langTextActive: { color: colors.text },
  hero: { alignItems: "center", marginTop: spacing(8), marginBottom: spacing(8) },
  logoTile: {
    width: 104,
    height: 104,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(5),
  },
  brand: { ...type.hero, fontSize: 40, lineHeight: 46, letterSpacing: 0.5 },
  tagline: { fontFamily: fonts.display, fontSize: 18, color: colors.accentSoft, marginTop: spacing(1) },
  heroText: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing(3),
    maxWidth: 300,
  },
  card: { borderRadius: radius.xl, padding: spacing(5), backgroundColor: "#FFFFFF", ...cardShadow },
  cardTitle: { ...type.h1, fontSize: 24 },
  cardSubtitle: { ...type.small, marginTop: spacing(1) },
  fields: { gap: spacing(4), marginTop: spacing(5) },
  forgot: { alignSelf: "flex-end", marginTop: -spacing(2) },
  forgotText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accentSoft },
  message: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing(3),
    marginTop: spacing(4),
  },
  error: { backgroundColor: tint(colors.danger, 0.12), borderColor: tint(colors.danger, 0.35) },
  info: { backgroundColor: tint(colors.accent, 0.14), borderColor: tint(colors.accent, 0.35) },
  messageText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  submit: { marginTop: spacing(6) },
  footer: { ...type.caption, textAlign: "center", marginTop: spacing(5) },
  newDriver: { marginTop: spacing(5), gap: spacing(2), alignItems: "center" },
  newDriverTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  newDriverActions: { gap: spacing(2), alignSelf: "stretch" },
}));
