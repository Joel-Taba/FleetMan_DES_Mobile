import { router } from "expo-router";
import { ArrowLeft, KeyRound, Mail, MailCheck, Send } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { requestPasswordReset } from "@/api/account";
import { ApiError } from "@/api/client";
import { AppHeader, GlassCard, PillButton, Screen, TextField } from "@/components/ui";
import { useT } from "@/i18n";
import { InlineMessage } from "@/features/common/InlineMessage";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

const COOLDOWN_S = 60;

/**
 * Mot de passe oublié (sans session), comme le web : l'email reçoit un lien de
 * réinitialisation. Réponse neutre que le compte existe ou non (pas d'énumération).
 */
export default function ForgotPasswordScreen() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  async function submit() {
    setError(null);
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError(t("Veuillez entrer une adresse email valide."));
    setSending(true);
    try {
      await requestPasswordReset(value);
      setSent(true);
      setCooldown(COOLDOWN_S);
    } catch (e) {
      // Seules une coupure réseau ou une panne du service sont signalées ; sinon réponse neutre.
      if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) {
        setError(
          e.status === 0
            ? `${t("Connexion au serveur impossible.")} ${t("Vérifiez votre connexion internet et réessayez.")}`
            : t("Le service d'authentification est momentanément indisponible. Réessayez dans quelques instants.")
        );
      } else {
        setSent(true);
        setCooldown(COOLDOWN_S);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen header={<AppHeader title={t("Mot de passe oublié")} onBack={back} />}>
      <View style={styles.stack}>
        {sent ? (
          <GlassCard>
            <View style={styles.center}>
              <View style={styles.icon}>
                <MailCheck size={34} color={colors.success} />
              </View>
              <Text style={styles.title}>{t("Vérifiez votre messagerie")}</Text>
              <Text style={styles.text}>
                {t("Si un compte existe pour")} <Text style={styles.strong}>{email.trim()}</Text>
                {t(", vous recevrez un lien de réinitialisation. Vérifiez aussi vos spams.")}
              </Text>
              <Text style={styles.text}>{t("Ouvrez le lien depuis ce téléphone, ou collez-le dans l'écran suivant.")}</Text>
            </View>
            <View style={styles.actions}>
              <PillButton label={t("J'ai reçu le lien")} icon={KeyRound} onPress={() => router.push("/reset-password")} />
              <PillButton
                label={cooldown > 0 ? `${t("Renvoyer le lien")} (${cooldown} s)` : t("Renvoyer le lien")}
                variant="glass"
                disabled={cooldown > 0}
                onPress={() => {
                  setSent(false);
                  setCooldown(0);
                }}
              />
              <PillButton label={t("Retour à la connexion")} icon={ArrowLeft} iconPosition="left" variant="ghost" onPress={back} />
            </View>
          </GlassCard>
        ) : (
          <GlassCard>
            <Text style={styles.title}>{t("Réinitialiser votre mot de passe")}</Text>
            <Text style={[styles.text, { textAlign: "left", marginTop: spacing(1) }]}>
              {t("Entrez l'adresse email de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.")}
            </Text>
            <View style={styles.fields}>
              <TextField
                label={t("Adresse email")}
                value={email}
                onChangeText={setEmail}
                placeholder={t("vous@entreprise.cm")}
                icon={Mail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InlineMessage text={error} />
              <PillButton label={sending ? t("Envoi…") : t("Envoyer le lien")} icon={Send} size="lg" loading={sending} onPress={() => void submit()} />
            </View>
            <Text style={styles.note}>{t("Pas d'adresse email sur votre compte ? Demandez à votre gestionnaire de réinitialiser votre accès.")}</Text>
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
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: "center" },
  strong: { fontFamily: fonts.bodySemibold, color: colors.text },
  fields: { gap: spacing(4), marginTop: spacing(5) },
  actions: { gap: spacing(3), marginTop: spacing(5) },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: spacing(4) },
}));
