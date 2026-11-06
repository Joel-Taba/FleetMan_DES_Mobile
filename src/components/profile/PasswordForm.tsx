import { Check, KeyRound, LockKeyhole, ShieldCheck, X } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { changeMyPassword } from "@/api/account";
import { PillButton, TextField } from "@/components/ui";
import { useT } from "@/i18n";
import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";

import { checkPasswordStrength, isPasswordStrong, passwordScore } from "./password";

const CRITERIA: { key: keyof ReturnType<typeof checkPasswordStrength>; label: string }[] = [
  { key: "length", label: "Au moins 10 caractères" },
  { key: "upper", label: "Une majuscule" },
  { key: "lower", label: "Une minuscule" },
  { key: "digit", label: "Un chiffre" },
  { key: "symbol", label: "Un caractère spécial" },
];

function strengthColor(score: number): string {
  if (score >= 5) return colors.success;
  if (score >= 3) return colors.warning;
  return colors.danger;
}

/** Strength meter: five segments plus the checklist of the Kernel password policy. */
export function StrengthMeter({ password }: { password: string }) {
  const { t } = useT();
  const score = passwordScore(password);
  const checks = checkPasswordStrength(password);
  const color = strengthColor(score);
  const label = score >= 5 ? t("Fort") : score >= 3 ? t("Moyen") : t("Faible");
  return (
    <View style={styles.meter}>
      <View style={styles.segments}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < score ? color : colors.track }]} />
        ))}
      </View>
      {password ? <Text style={[styles.strength, { color }]}>{label}</Text> : null}
      <View style={styles.criteria}>
        {CRITERIA.map(({ key, label: text }) => {
          const ok = checks[key];
          const Icon = ok ? Check : X;
          return (
            <View key={key} style={styles.criterion}>
              <Icon size={14} color={ok ? colors.success : colors.textMuted} strokeWidth={2.5} />
              <Text style={[styles.criterionText, ok && { color: colors.text }]}>{t(text)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Password change form (PUT /api/v1/account/password). */
export function PasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;

  async function submit() {
    setError(null);
    setSuccess(false);
    if (!current || !next || !confirm) return setError(t("Veuillez remplir tous les champs."));
    if (!isPasswordStrong(next)) return setError(t("Le nouveau mot de passe ne respecte pas les règles de sécurité."));
    if (next !== confirm) return setError(t("Les mots de passe ne correspondent pas."));
    if (next === current) return setError(t("Le nouveau mot de passe doit être différent de l'actuel."));
    setSaving(true);
    try {
      await changeMyPassword(current, next);
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(onDone, 1500);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : t("Une erreur est survenue"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField label={t("Mot de passe actuel")} value={current} onChangeText={setCurrent} secureTextEntry icon={LockKeyhole} />
      <TextField label={t("Nouveau mot de passe")} value={next} onChangeText={setNext} secureTextEntry icon={KeyRound} />
      <StrengthMeter password={next} />
      <TextField
        label={t("Confirmer le mot de passe")}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        icon={KeyRound}
        error={mismatch ? t("Les mots de passe ne correspondent pas.") : null}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? (
        <View style={styles.success}>
          <ShieldCheck size={16} color={colors.success} />
          <Text style={styles.successText}>{t("Mot de passe modifié avec succès.")}</Text>
        </View>
      ) : null}
      <PillButton label={t("Mettre à jour le mot de passe")} onPress={submit} loading={saving} icon={Check} />
    </View>
  );
}

const styles = themedStyles(() => ({
  form: { gap: spacing(4), paddingTop: spacing(2) },
  meter: { gap: 8, marginTop: -4 },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  strength: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  criteria: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 },
  criterion: { flexDirection: "row", alignItems: "center", gap: 5 },
  criterionText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger },
  success: { flexDirection: "row", alignItems: "center", gap: 8 },
  successText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.success },
}));
