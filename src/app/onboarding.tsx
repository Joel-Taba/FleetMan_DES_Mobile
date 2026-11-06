import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { Camera, CheckCircle2, SkipForward, FileUp, HeartPulse, Home, LogOut, Phone, Save, UserRound } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { fetchMyAccount, uploadMyProfilePicture } from "@/api/account";
import { completeOnboarding, fetchOnboarding, skipOnboarding, updateOnboardingProfile, type OnboardingStatus } from "@/api/registration";
import { confirmAction } from "@/components/profile/confirm";
import { useAuth } from "@/auth/AuthContext";
import { AppHeader, Avatar, Badge, GlassCard, LoadingState, PillButton, Screen, SectionHeader, TextField, DateField } from "@/components/ui";
import { InlineMessage } from "@/features/common/InlineMessage";
import { errorMessage } from "@/features/common/media";
import { DOC_TYPE_LABELS, STATE_LABEL, STATE_TONE } from "@/features/documents/docTypes";
import { consumeActivatedUsername, setOnboarded } from "@/features/onboarding/gate";
import { useT } from "@/i18n";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

const PROVIDED = ["PENDING", "OK", "EXPIRING"];

/**
 * Finalisation de l'inscription, juste après l'activation du compte : profil complet et pièces
 * obligatoires déposées avant d'accéder à l'interface de travail. Les pièces facultatives
 * peuvent être ajoutées plus tard depuis « Mes documents ».
 */
export default function OnboardingScreen() {
  const { t } = useT();
  const { user, logout, updateUser } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [username] = useState(consumeActivatedUsername);
  const [form, setForm] = useState({ phone: "", birthDate: "", address: "", emergencyContactName: "", emergencyContactPhone: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((s: OnboardingStatus, resetForm: boolean) => {
    setStatus(s);
    if (resetForm) {
      setForm({
        phone: s.profile.phone ?? "",
        birthDate: s.profile.birthDate ?? "",
        address: s.profile.address ?? "",
        emergencyContactName: s.profile.emergencyContactName ?? "",
        emergencyContactPhone: s.profile.emergencyContactPhone ?? "",
      });
    }
  }, []);

  const load = useCallback(
    async (resetForm: boolean) => {
      try {
        const s = await fetchOnboarding();
        setLoadError(null);
        apply(s, resetForm);
        if (s.completed && user) {
          setOnboarded(user.id, true);
          router.replace("/(tabs)");
        }
      } catch (e) {
        setLoadError(errorMessage(e, "Impossible de charger votre inscription."));
      }
    },
    [apply, user]
  );

  useEffect(() => {
    // Premier chargement hors du rendu de l'effet (règle react-hooks/set-state-in-effect).
    const timer = setTimeout(() => void load(true), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Retour du dépôt d'une pièce : les états sont relus sans effacer la saisie.
  useFocusEffect(
    useCallback(() => {
      if (status) void load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const set = (key: keyof typeof form) => (value: string) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function saveProfile() {
    setError(null);
    setSaved(false);
    const birth = form.birthDate.trim() || undefined;
    setSaving(true);
    try {
      const s = await updateOnboardingProfile({
        birthDate: birth ?? undefined,
        address: form.address.trim() || undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        phone: !status?.profile.phone && form.phone.trim() ? form.phone.trim() : undefined,
      });
      apply(s, false);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e, "Action impossible."));
    } finally {
      setSaving(false);
    }
  }

  async function changePhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      await uploadMyProfilePicture(result.assets[0]);
      const fresh = await fetchMyAccount();
      updateUser({ photoUrl: fresh?.photoUrl ?? undefined });
      await load(false);
    } catch (e) {
      setError(errorMessage(e, "Impossible de mettre à jour la photo."));
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    setError(null);
    setFinishing(true);
    try {
      const s = await completeOnboarding();
      if (s.completed && user) {
        setOnboarded(user.id, true);
        router.replace("/(tabs)");
      }
    } catch (e) {
      setError(errorMessage(e, "Action impossible."));
      void load(false);
    } finally {
      setFinishing(false);
    }
  }

  async function skip() {
    const ok = await confirmAction(
      t("Passer cette étape ?"),
      t("Vous accéderez à votre espace, mais vous ne pourrez pas être engagé sur un trajet ou un poste tant que vos pièces obligatoires ne sont pas validées. Vous pourrez compléter depuis « Mon profil » et « Mes documents »."),
      t("Passer"),
      t("Annuler")
    );
    if (!ok) return;
    setError(null);
    setFinishing(true);
    try {
      const s = await skipOnboarding();
      if (s.completed && user) {
        setOnboarded(user.id, true);
        router.replace("/(tabs)");
      }
    } catch (e) {
      setError(errorMessage(e, "Action impossible."));
    } finally {
      setFinishing(false);
    }
  }

  const header = (
    <AppHeader
      title={t("Finaliser mon inscription")}
      right={
        <Pressable onPress={() => void logout()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Se déconnecter")}>
          <LogOut size={20} color={colors.textSecondary} />
        </Pressable>
      }
    />
  );

  if (!status) {
    return (
      <Screen header={header}>
        {loadError ? <InlineMessage text={loadError} /> : <LoadingState />}
        {loadError ? <PillButton label={t("Réessayer")} onPress={() => void load(true)} style={{ marginTop: spacing(4) }} /> : null}
      </Screen>
    );
  }

  const missing = new Set(status.missingProfile);
  const p = status.profile;
  const docsLeft = status.documents.filter((d) => !PROVIDED.includes(d.state)).length;

  return (
    <Screen header={header} refreshing={false} onRefresh={() => void load(false)}>
      <View style={styles.stack}>
        <GlassCard>
          <Text style={styles.title}>
            {t("Bienvenue")} {p.firstName} !
          </Text>
          <Text style={styles.text}>
            {t("Votre compte est actif")}{p.fleetName ? ` (${p.fleetName})` : ""}.{" "}
            {t("Complétez votre profil et déposez vos pièces obligatoires pour accéder à votre espace de travail.")}
          </Text>
          {username ? (
            <View style={styles.username}>
              <Text style={styles.usernameLabel}>{t("Votre identifiant de connexion")}</Text>
              <Text style={styles.usernameValue}>{username}</Text>
              <Text style={styles.hint}>{t("Vous pouvez aussi vous connecter avec votre numéro de téléphone.")}</Text>
            </View>
          ) : null}
          <View style={styles.progress}>
            <Step done={missing.size === 0} label={t("Profil")} />
            <Step done={docsLeft === 0} label={t("Pièces obligatoires")} />
          </View>
        </GlassCard>

        <SectionHeader title={t("Mon profil")} />
        <GlassCard>
          <View style={styles.photoRow}>
            <Avatar name={`${p.firstName} ${p.lastName}`} photoUrl={p.photoUrl ?? undefined} size={64} />
            <View style={{ flex: 1, gap: spacing(1) }}>
              <Text style={styles.strong}>{t("Photo de profil")}</Text>
              <Text style={styles.hint}>{missing.has("PHOTO") ? t("Obligatoire : une photo nette de votre visage.") : t("Photo enregistrée.")}</Text>
            </View>
            <PillButton label={uploading ? t("Envoi…") : t("Choisir")} icon={Camera} variant="glass" loading={uploading} onPress={() => void changePhoto()} />
          </View>
          <View style={styles.fields}>
            {!p.phone ? (
              <TextField label={t("Téléphone")} value={form.phone} onChangeText={set("phone")} icon={Phone} keyboardType="phone-pad" placeholder="+237 6XX XX XX XX" />
            ) : null}
            <DateField
              label={t("Date de naissance")}
              value={form.birthDate}
              onChange={set("birthDate")}
              maximumDate={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())}
              minimumDate={new Date(new Date().getFullYear() - 80, 0, 1)}
            />
            <TextField label={t("Adresse (ville, quartier)")} value={form.address} onChangeText={set("address")} icon={Home} />
            <TextField label={t("Personne à prévenir en cas d'urgence")} value={form.emergencyContactName} onChangeText={set("emergencyContactName")} icon={UserRound} autoCapitalize="words" />
            <TextField label={t("Téléphone de cette personne")} value={form.emergencyContactPhone} onChangeText={set("emergencyContactPhone")} icon={HeartPulse} keyboardType="phone-pad" />
            {saved ? <Text style={[styles.hint, { color: colors.success }]}>{t("Profil enregistré.")}</Text> : null}
            <PillButton label={saving ? t("Patientez…") : t("Enregistrer mon profil")} icon={Save} variant="glass" loading={saving} onPress={() => void saveProfile()} />
          </View>
        </GlassCard>

        <SectionHeader title={t("Mes pièces obligatoires")} />
        <GlassCard>
          <Text style={styles.hint}>
            {t("Une pièce déposée est contrôlée par votre gestionnaire. Les pièces facultatives pourront être ajoutées plus tard depuis « Mes documents ».")}
          </Text>
          <View style={{ gap: spacing(3), marginTop: spacing(3) }}>
            {status.documents.map((d) => {
              const provided = PROVIDED.includes(d.state);
              return (
                <View key={d.docType} style={styles.doc}>
                  <View style={{ flex: 1, gap: spacing(1) }}>
                    <Text style={styles.strong}>{t(DOC_TYPE_LABELS[d.docType] ?? d.label)}</Text>
                    <Badge label={t(STATE_LABEL[d.state] ?? d.state)} tone={STATE_TONE[d.state] ?? "muted"} />
                  </View>
                  {!provided ? (
                    <PillButton
                      label={d.state === "MISSING" ? t("Déposer") : t("Redéposer")}
                      icon={FileUp}
                      variant="glass"
                      onPress={() => user && router.push({ pathname: "/document-upload", params: { targetId: user.id, docType: d.docType } })}
                    />
                  ) : (
                    <CheckCircle2 size={22} color={colors.success} />
                  )}
                </View>
              );
            })}
          </View>
        </GlassCard>

        <InlineMessage text={error} />
        <PillButton
          label={finishing ? t("Patientez…") : t("Accéder à mon espace")}
          icon={CheckCircle2}
          size="lg"
          disabled={!status.canComplete}
          loading={finishing}
          onPress={() => void finish()}
        />
        {!status.canComplete ? (
          <Text style={[styles.hint, { textAlign: "center" }]}>
            {t("Complétez votre profil et déposez chaque pièce obligatoire pour continuer.")}
          </Text>
        ) : null}
        {!status.canComplete ? (
          <PillButton label={t("Passer cette étape")} icon={SkipForward} variant="ghost" disabled={finishing} onPress={() => void skip()} />
        ) : null}
      </View>
    </Screen>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={[styles.step, done && styles.stepDone]}>
      <CheckCircle2 size={16} color={done ? colors.success : colors.textMuted} />
      <Text style={[styles.stepText, done && { color: colors.success }]}>{label}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4), paddingTop: spacing(2) },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: spacing(1) },
  strong: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  username: {
    marginTop: spacing(4),
    padding: spacing(3),
    borderRadius: radius.md,
    backgroundColor: tint(colors.accent, 0.08),
    gap: spacing(1),
  },
  usernameLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  usernameValue: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  progress: { flexDirection: "row", gap: spacing(2), marginTop: spacing(4), flexWrap: "wrap" },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    backgroundColor: colors.track,
  },
  stepDone: { backgroundColor: tint(colors.success, 0.12) },
  stepText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary },
  photoRow: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  fields: { gap: spacing(4), marginTop: spacing(5) },
  doc: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
}));
