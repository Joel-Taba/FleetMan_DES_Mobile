import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, IdCard, KeyRound, Mail, Phone, Send, Truck, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { submitRegistration } from "@/api/registration";
import { AppHeader, GlassCard, PillButton, Screen, TextField } from "@/components/ui";
import { InlineMessage } from "@/features/common/InlineMessage";
import { useT } from "@/i18n";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

/**
 * Demande d'inscription (sans session) : code de la flotte remis par le gestionnaire, identité,
 * n° de permis, et un téléphone ou un e-mail pour recevoir le code d'activation.
 */
export default function RegisterScreen() {
  const { t } = useT();
  const [form, setForm] = useState({ fleetCode: "", firstName: "", lastName: "", licenceNumber: "", phone: "+237 ", email: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ fleetName: string; contact: string } | null>(null);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const back = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  async function submit() {
    setError(null);
    const phone = form.phone.replace(/[^0-9+]/g, "");
    const hasPhone = phone.replace("+237", "").length > 0;
    const email = form.email.trim();
    if (!form.fleetCode.trim()) return setError(t("Saisissez le code de la flotte remis par votre gestionnaire."));
    if (!form.firstName.trim() || !form.lastName.trim()) return setError(t("Saisissez votre prénom et votre nom."));
    if (!form.licenceNumber.trim()) return setError(t("Saisissez votre numéro de permis."));
    if (!hasPhone && !email) return setError(t("Indiquez un numéro de téléphone ou une adresse e-mail pour recevoir votre code."));
    if (hasPhone && !/^\+?[0-9]{8,15}$/.test(phone)) return setError(t("Numéro de téléphone invalide."));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(t("Veuillez entrer une adresse email valide."));
    setSending(true);
    try {
      const res = await submitRegistration({
        fleetCode: form.fleetCode.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        licenceNumber: form.licenceNumber.trim(),
        phone: hasPhone ? phone : undefined,
        email: email || undefined,
      });
      setDone({ fleetName: res.fleetName, contact: hasPhone ? phone : email });
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
    <Screen header={<AppHeader title={t("Créer mon compte")} onBack={back} />}>
      <View style={styles.stack}>
        {done ? (
          <GlassCard>
            <View style={styles.center}>
              <View style={styles.icon}>
                <CheckCircle2 size={34} color={colors.success} />
              </View>
              <Text style={styles.title}>{t("Demande envoyée")}</Text>
              <Text style={styles.text}>
                {t("Votre demande pour rejoindre")} <Text style={styles.strong}>{done.fleetName}</Text>{" "}
                {t("a été transmise à votre gestionnaire.")}
              </Text>
              <Text style={styles.text}>
                {t("Dès qu'il l'aura acceptée, vous recevrez votre code d'activation par SMS ou par e-mail, ou de sa main.")}
              </Text>
            </View>
            <View style={styles.actions}>
              <PillButton
                label={t("J'ai reçu mon code")}
                icon={KeyRound}
                onPress={() => router.replace({ pathname: "/activate", params: { contact: done.contact } })}
              />
              <PillButton label={t("Retour à la connexion")} icon={ArrowLeft} iconPosition="left" variant="ghost" onPress={() => router.replace("/login")} />
            </View>
          </GlassCard>
        ) : (
          <GlassCard>
            <Text style={styles.title}>{t("Rejoindre une flotte")}</Text>
            <Text style={[styles.text, styles.left]}>
              {t("Votre gestionnaire vous communique le code de sa flotte. Il validera votre demande avant que vous puissiez activer votre compte.")}
            </Text>
            <View style={styles.fields}>
              <TextField label={t("Code de la flotte")} value={form.fleetCode} onChangeText={set("fleetCode")} placeholder="K7Q2MX" icon={Truck} autoCapitalize="characters" />
              <TextField label={t("Prénom")} value={form.firstName} onChangeText={set("firstName")} icon={UserRound} autoCapitalize="words" />
              <TextField label={t("Nom")} value={form.lastName} onChangeText={set("lastName")} icon={UserRound} autoCapitalize="words" />
              <TextField label={t("N° de permis de conduire")} value={form.licenceNumber} onChangeText={set("licenceNumber")} placeholder="CM-B-123456" icon={IdCard} autoCapitalize="characters" />
              <Text style={styles.hint}>{t("Pour recevoir votre code d'activation, indiquez au moins l'un des deux :")}</Text>
              <TextField label={t("Téléphone")} value={form.phone} onChangeText={set("phone")} icon={Phone} keyboardType="phone-pad" />
              <TextField label={t("Adresse e-mail (facultative)")} value={form.email} onChangeText={set("email")} placeholder={t("vous@entreprise.cm")} icon={Mail} keyboardType="email-address" autoCapitalize="none" />
              <InlineMessage text={error} />
              <PillButton label={sending ? t("Envoi…") : t("Envoyer ma demande")} icon={Send} size="lg" loading={sending} onPress={() => void submit()} />
            </View>
            <PillButton
              label={t("J'ai déjà un code d'activation")}
              icon={KeyRound}
              variant="ghost"
              style={{ marginTop: spacing(3) }}
              onPress={() => router.replace("/activate")}
            />
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
  left: { textAlign: "left", marginTop: spacing(1) },
  strong: { fontFamily: fonts.bodySemibold, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  fields: { gap: spacing(4), marginTop: spacing(5) },
  actions: { gap: spacing(3), marginTop: spacing(5) },
}));
