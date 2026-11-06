import { router, useLocalSearchParams } from "expo-router";
import { KeyRound, LockKeyhole, Phone, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { activateAccount } from "@/api/registration";
import { mapAuthUser, saveSession } from "@/auth/session";
import { DRIVER_ROLE } from "@/auth/types";
import { AppHeader, GlassCard, PillButton, Screen, TextField } from "@/components/ui";
import { StrengthMeter } from "@/components/profile/PasswordForm";
import { isPasswordStrong } from "@/components/profile/password";
import { InlineMessage } from "@/features/common/InlineMessage";
import { rememberActivatedUsername, setOnboarded } from "@/features/onboarding/gate";
import { useT } from "@/i18n";
import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";

/**
 * Activation du compte avec le code reçu (SMS, e-mail ou remis par le gestionnaire) :
 * le chauffeur choisit son mot de passe, le compte est créé et la session ouverte.
 */
export default function ActivateScreen() {
  const { t } = useT();
  const params = useLocalSearchParams<{ contact?: string }>();
  const [contact, setContact] = useState(params.contact ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  async function submit() {
    setError(null);
    if (!contact.trim()) return setError(t("Saisissez le téléphone ou l'e-mail indiqué dans votre demande."));
    if (code.replace(/[^A-Za-z0-9]/g, "").length !== 8) return setError(t("Le code d'activation compte 8 caractères."));
    if (!isPasswordStrong(password)) return setError(t("Le mot de passe ne respecte pas les règles de sécurité."));
    if (password !== confirm) return setError(t("Les deux mots de passe ne correspondent pas."));
    setSending(true);
    try {
      const res = await activateAccount(contact.trim(), code, password);
      const user = mapAuthUser(res.auth.user);
      if (!user.roles.includes(DRIVER_ROLE)) user.roles = [...user.roles, DRIVER_ROLE];
      rememberActivatedUsername(res.username);
      setOnboarded(user.id, false);
      // La session ouverte, la navigation mène à la finalisation de l'inscription.
      await saveSession({ accessToken: res.auth.accessToken, refreshToken: res.auth.refreshToken ?? "", user });
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setError(`${t("Connexion au serveur impossible.")} ${t("Vérifiez votre connexion internet et réessayez.")}`);
      } else {
        setError(e instanceof Error ? e.message : t("Action impossible."));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen header={<AppHeader title={t("Activer mon compte")} onBack={back} />}>
      <View style={styles.stack}>
        <GlassCard>
          <Text style={styles.title}>{t("Votre code d'activation")}</Text>
          <Text style={styles.text}>
            {t("Saisissez le code reçu après l'acceptation de votre demande, puis choisissez votre mot de passe. Personne d'autre ne le connaîtra.")}
          </Text>
          <View style={styles.fields}>
            <TextField
              label={t("Téléphone ou e-mail de votre demande")}
              value={contact}
              onChangeText={setContact}
              icon={Phone}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextField label={t("Code d'activation")} value={code} onChangeText={setCode} placeholder="ABCD-EFGH" icon={KeyRound} autoCapitalize="characters" />
            <TextField label={t("Mot de passe")} value={password} onChangeText={setPassword} icon={LockKeyhole} secureTextEntry />
            <StrengthMeter password={password} />
            <TextField label={t("Confirmer le mot de passe")} value={confirm} onChangeText={setConfirm} icon={LockKeyhole} secureTextEntry />
            <InlineMessage text={error} />
            <PillButton label={sending ? t("Patientez…") : t("Activer mon compte")} icon={ShieldCheck} size="lg" loading={sending} onPress={() => void submit()} />
          </View>
          <Text style={styles.note}>
            {t("Code expiré ou perdu ? Votre gestionnaire peut en générer un nouveau.")}
          </Text>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4), paddingTop: spacing(2) },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: spacing(1) },
  fields: { gap: spacing(4), marginTop: spacing(5) },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: spacing(4) },
}));
