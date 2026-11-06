import { router, useLocalSearchParams } from "expo-router";
import { Check, KeyRound, Link2, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { resetPassword } from "@/api/account";
import { ApiError } from "@/api/client";
import { StrengthMeter } from "@/components/profile/PasswordForm";
import { isPasswordStrong } from "@/components/profile/password";
import { AppHeader, GlassCard, PillButton, Screen, TextField } from "@/components/ui";
import { useT } from "@/i18n";
import { InlineMessage } from "@/features/common/InlineMessage";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

/** Jeton tiré d'un lien collé (…/reset-password?token=XYZ) ou saisi tel quel. */
function extractToken(input: string): string {
  const value = input.trim();
  const match = value.match(/[?&]token=([^&#\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return value;
}

/**
 * Nouveau mot de passe avec le jeton reçu par email. Ouvert par le lien
 * fleetman://reset-password?token=… ou en collant le lien reçu.
 */
export default function ResetPasswordScreen() {
  const { t } = useT();
  const params = useLocalSearchParams<{ token?: string }>();
  const fromLink = typeof params.token === "string" ? params.token.trim() : "";
  const [link, setLink] = useState(fromLink);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.replace("/login"), 2000);
    return () => clearTimeout(timer);
  }, [done]);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit() {
    setError(null);
    const token = extractToken(link);
    if (!token) return setError(t("Collez le lien ou le code reçu par email."));
    if (!isPasswordStrong(password)) {
      return setError(t("Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre et un symbole."));
    }
    if (password !== confirm) return setError(t("Les mots de passe ne correspondent pas."));
    setSaving(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setError(`${t("Connexion au serveur impossible.")} ${t("Vérifiez votre connexion internet et réessayez.")}`);
      } else {
        setError(e instanceof Error && e.message ? e.message : t("Impossible de réinitialiser le mot de passe."));
      }
    } finally {
      setSaving(false);
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  return (
    <Screen header={<AppHeader title={t("Nouveau mot de passe")} onBack={back} />}>
      <View style={styles.stack}>
        {done ? (
          <GlassCard>
            <View style={styles.center}>
              <View style={styles.icon}>
                <ShieldCheck size={34} color={colors.success} />
              </View>
              <Text style={styles.title}>{t("Mot de passe mis à jour")}</Text>
              <Text style={styles.text}>{t("Redirection vers la page de connexion…")}</Text>
              <PillButton label={t("Se connecter")} onPress={() => router.replace("/login")} style={{ alignSelf: "stretch", marginTop: spacing(3) }} />
            </View>
          </GlassCard>
        ) : (
          <GlassCard>
            <Text style={styles.title}>{t("Choisissez un nouveau mot de passe")}</Text>
            <Text style={styles.text}>{t("Il remplacera l'ancien sur l'application et sur le web.")}</Text>
            <View style={styles.fields}>
              {fromLink ? null : (
                <TextField
                  label={t("Lien ou code reçu par email")}
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://…/reset-password?token=…"
                  icon={Link2}
                  autoCapitalize="none"
                />
              )}
              <TextField label={t("Nouveau mot de passe")} value={password} onChangeText={setPassword} secureTextEntry icon={KeyRound} />
              <StrengthMeter password={password} />
              <TextField
                label={t("Confirmer le mot de passe")}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                icon={KeyRound}
                error={mismatch ? t("Les mots de passe ne correspondent pas.") : null}
              />
              <InlineMessage text={error} />
              <PillButton label={t("Enregistrer")} icon={Check} size="lg" loading={saving} onPress={() => void submit()} />
            </View>
            {fromLink ? null : (
              <PillButton
                label={t("Demander un nouveau lien")}
                variant="ghost"
                onPress={() => router.replace("/forgot-password")}
                style={{ marginTop: spacing(3) }}
              />
            )}
          </GlassCard>
        )}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4), paddingTop: spacing(2) },
  center: { alignItems: "center", gap: spacing(2) },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint(colors.success, 0.15),
    marginBottom: spacing(1),
  },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: spacing(1) },
  fields: { gap: spacing(4), marginTop: spacing(5) },
}));
