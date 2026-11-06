import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import {
  AtSign,
  BadgeCheck,
  Bell,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  Clock,
  FileWarning,
  IdCard,
  Info,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Phone,
  Save,
  Server,
  ShieldAlert,
  Sun,
  UserRound,
  Volume2,
  WifiOff,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";

import { fetchMyAccount, updateMyAccount, uploadMyProfilePicture } from "@/api/account";
import { API_URL, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { confirmAction } from "@/components/profile/confirm";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { useNotificationPrefs, type NotificationPrefs } from "@/components/profile/useNotificationPrefs";
import {
  AppHeader,
  Avatar,
  Badge,
  Divider,
  GlassCard,
  IconButton,
  ListIcon,
  ListItem,
  PillButton,
  Screen,
  SectionHeader,
  StatRow,
  TextField,
} from "@/components/ui";
import { useApiQuery } from "@/hooks/useApiQuery";
import { LANGUAGES, useT } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { useThemePreference, type ThemePreference } from "@/theme/scheme";
import { colors, fonts, radius, spacing, tint, themedStyles, themed } from "@/theme/tokens";

const PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorText(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message || fallback : fallback;
}

// react-native-web colors the "on" thumb with its own prop (Material teal by default).
const WEB_SWITCH_COLORS = themed(() => ({ activeThumbColor: "#FFFFFF", activeTrackColor: colors.accent })) as object;

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

function ToggleRow({
  icon: Icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      left={
        <ListIcon>
          <Icon size={18} color={colors.accentSoft} />
        </ListIcon>
      }
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.trackStrong, true: colors.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.trackStrong}
          accessibilityLabel={title}
          {...WEB_SWITCH_COLORS}
        />
      }
    />
  );
}

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { t, lang, setLang } = useT();
  const account = useApiQuery("account", fetchMyAccount);
  const { prefs, toggle } = useNotificationPrefs(user?.id);
  const [themePref, setThemePref] = useThemePreference();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const profile = account.data;

  // Keeps the session user in sync with the server profile.
  useEffect(() => {
    if (!profile) return;
    updateUser({
      firstName: profile.firstName || undefined,
      lastName: profile.lastName || undefined,
      email: profile.email || undefined,
      phone: profile.phone ?? "",
      photoUrl: profile.photoUrl ?? undefined,
    });
  }, [profile, updateUser]);

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username;
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  function startEditing() {
    setForm({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    });
    setFormError(null);
    setSaved(false);
    setEditing(true);
  }

  async function saveProfile() {
    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
    };
    if (!body.firstName || !body.lastName) return setFormError(t("Le prénom et le nom sont obligatoires."));
    if (!EMAIL_PATTERN.test(body.email)) return setFormError(t("Adresse email invalide."));
    if (body.phone && !PHONE_PATTERN.test(body.phone)) return setFormError(t("Numéro de téléphone invalide."));
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateMyAccount(body);
      updateUser({
        firstName: updated?.firstName ?? body.firstName,
        lastName: updated?.lastName ?? body.lastName,
        email: updated?.email ?? body.email,
        phone: updated?.phone ?? body.phone ?? "",
      });
      setEditing(false);
      setSaved(true);
      void account.refetch();
    } catch (e) {
      setFormError(errorText(e, t("Une erreur est survenue")));
    } finally {
      setSaving(false);
    }
  }

  async function changePhoto() {
    setPhotoError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      await uploadMyProfilePicture(result.assets[0]);
      const fresh = await fetchMyAccount();
      updateUser({ photoUrl: fresh?.photoUrl ?? undefined });
      void account.refetch();
    } catch (e) {
      setPhotoError(errorText(e, t("Impossible de mettre à jour la photo.")));
    } finally {
      setUploading(false);
    }
  }

  async function onLogout() {
    const ok = await confirmAction(
      t("Se déconnecter"),
      t("Voulez-vous vraiment vous déconnecter ?"),
      t("Se déconnecter"),
      t("Annuler")
    );
    if (ok) await logout();
  }

  const notificationRows: { key: keyof NotificationPrefs; icon: LucideIcon; title: string; subtitle: string }[] = [
    { key: "assignments", icon: Car, title: t("Nouvelles affectations"), subtitle: t("Véhicule ou trajet attribué") },
    { key: "tripReminders", icon: Clock, title: t("Rappels de trajet"), subtitle: t("Avant chaque départ prévu") },
    { key: "documents", icon: FileWarning, title: t("Documents à renouveler"), subtitle: t("Permis et pièces du véhicule") },
    { key: "incidents", icon: ShieldAlert, title: t("Suivi des incidents"), subtitle: t("Réponses à vos déclarations") },
    { key: "sound", icon: Volume2, title: t("Sons et vibrations"), subtitle: t("Pour les alertes importantes") },
  ];

  return (
    <Screen
      withTabBar
      onRefresh={account.refetch}
      refreshing={account.refreshing}
      header={
        <AppHeader
          title={t("Mon profil")}
          right={<IconButton icon={LogOut} onPress={onLogout} accessibilityLabel={t("Se déconnecter")} />}
        />
      }
    >
      {account.stale ? (
        <View style={styles.offline}>
          <WifiOff size={14} color={colors.warning} />
          <Text style={styles.offlineText}>{t("Hors ligne : dernières données connues.")}</Text>
        </View>
      ) : null}

      <GlassCard strong padding={spacing(5)} style={styles.hero}>
        <View>
          <Avatar name={fullName} photoUrl={user.photoUrl} size={96} />
          <Pressable
            onPress={changePhoto}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel={t("Changer la photo")}
            style={styles.cameraButton}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.ctaText} />
            ) : (
              <Camera size={16} color={colors.ctaText} strokeWidth={2.4} />
            )}
          </Pressable>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {fullName}
        </Text>
        <Text style={styles.username}>@{user.username}</Text>
        <View style={styles.badges}>
          <Badge label={codeLabel("FLEET_DRIVER")} tone="default" />
          {profile?.companyName ? <Badge label={profile.companyName} tone="muted" /> : null}
        </View>
        {photoError ? <Text style={styles.inlineError}>{photoError}</Text> : null}
      </GlassCard>

      <View style={styles.stats}>
        <StatRow
          items={[
            { icon: IdCard, label: t("Permis"), value: profile?.licenceNumber || "-" },
            { icon: Car, label: t("Véhicule"), value: profile?.vehicleId ? t("Affecté") : t("Aucun") },
            { icon: Clock, label: t("Dernière connexion"), value: formatDate(profile?.lastLoginAt) },
          ]}
        />
      </View>

      <SectionHeader
        title={t("Informations personnelles")}
        actionLabel={editing ? undefined : t("Modifier")}
        onAction={startEditing}
      />
      <GlassCard>
        {editing ? (
          <View style={styles.form}>
            <TextField
              label={t("Prénom")}
              value={form.firstName}
              onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
              icon={UserRound}
              autoCapitalize="words"
            />
            <TextField
              label={t("Nom")}
              value={form.lastName}
              onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
              icon={UserRound}
              autoCapitalize="words"
            />
            <TextField
              label={t("Email")}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              icon={Mail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextField
              label={t("Téléphone")}
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              icon={Phone}
              keyboardType="phone-pad"
              placeholder="+237 6XX XX XX XX"
            />
            {formError ? <Text style={styles.inlineError}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <PillButton label={t("Annuler")} variant="glass" onPress={() => setEditing(false)} style={styles.flex} />
              <PillButton
                label={t("Enregistrer")}
                icon={Save}
                iconPosition="left"
                onPress={saveProfile}
                loading={saving}
                style={styles.flex}
              />
            </View>
          </View>
        ) : (
          <>
            <ListItem
              title={user.email || "-"}
              subtitle={t("Email")}
              left={
                <ListIcon>
                  <Mail size={18} color={colors.accentSoft} />
                </ListIcon>
              }
            />
            <Divider />
            <ListItem
              title={user.phone || t("Non renseigné")}
              subtitle={t("Téléphone")}
              left={
                <ListIcon>
                  <Phone size={18} color={colors.accentSoft} />
                </ListIcon>
              }
            />
            <Divider />
            <ListItem
              title={user.username}
              subtitle={t("Nom d'utilisateur")}
              left={
                <ListIcon>
                  <AtSign size={18} color={colors.accentSoft} />
                </ListIcon>
              }
            />
            {saved ? (
              <View style={styles.savedRow}>
                <BadgeCheck size={16} color={colors.success} />
                <Text style={styles.savedText}>{t("Profil mis à jour.")}</Text>
              </View>
            ) : null}
          </>
        )}
      </GlassCard>

      <SectionHeader title={t("Sécurité")} />
      <GlassCard>
        <ListItem
          title={t("Changer le mot de passe")}
          subtitle={t("10 caractères minimum, majuscule, chiffre et symbole")}
          onPress={() => setPasswordOpen((o) => !o)}
          left={
            <ListIcon>
              <KeyRound size={18} color={colors.accentSoft} />
            </ListIcon>
          }
          right={
            passwordOpen ? (
              <ChevronUp size={18} color={colors.textMuted} />
            ) : (
              <ChevronDown size={18} color={colors.textMuted} />
            )
          }
        />
        {passwordOpen ? (
          <>
            <Divider />
            <PasswordForm onDone={() => setPasswordOpen(false)} />
          </>
        ) : null}
      </GlassCard>

      <SectionHeader title={t("Notifications")} />
      <GlassCard>
        {notificationRows.map((row, index) => (
          <View key={row.key}>
            {index > 0 ? <Divider /> : null}
            <ToggleRow
              icon={row.icon}
              title={row.title}
              subtitle={row.subtitle}
              value={prefs[row.key]}
              onChange={(value) => toggle(row.key, value)}
            />
          </View>
        ))}
        <View style={styles.note}>
          <Bell size={13} color={colors.textMuted} />
          <Text style={styles.noteText}>{t("Préférences enregistrées sur cet appareil.")}</Text>
        </View>
      </GlassCard>

      <SectionHeader title={t("Langue")} />
      <GlassCard>
        <View style={styles.langGrid}>
          {LANGUAGES.map((l) => {
            const active = l.code === lang;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLang(l.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.langOption, active && styles.langOptionActive]}
              >
                <Text style={[styles.langShort, active && { color: colors.text }]}>{l.short}</Text>
                <Text style={[styles.langLabel, active && { color: colors.text }]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.note}>
          <Languages size={13} color={colors.textMuted} />
          <Text style={styles.noteText}>{t("La langue s'applique à toute l'application.")}</Text>
        </View>
      </GlassCard>

      <SectionHeader title={t("Thème")} />
      <GlassCard>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((o) => {
            const active = o.value === themePref;
            return (
              <Pressable
                key={o.value}
                onPress={() => setThemePref(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, checked: active }}
                accessibilityLabel={t(o.label)}
                style={[styles.themeOption, active && styles.langOptionActive]}
              >
                <o.icon size={20} color={active ? colors.text : colors.accentSoft} />
                <Text style={[styles.langLabel, active && { color: colors.text }]}>{t(o.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.note}>
          <Palette size={13} color={colors.textMuted} />
          <Text style={styles.noteText}>{t("Le thème s'applique à toute l'application.")}</Text>
        </View>
      </GlassCard>

      <SectionHeader title={t("À propos")} />
      <GlassCard>
        <ListItem
          title={`FleetMan ${t("Chauffeur")}`}
          subtitle={`${t("Version")} ${appVersion}`}
          left={
            <ListIcon>
              <Info size={18} color={colors.accentSoft} />
            </ListIcon>
          }
        />
        <Divider />
        <ListItem
          title={API_URL.replace(/^https?:\/\//, "")}
          subtitle={t("Serveur")}
          left={
            <ListIcon>
              <Server size={18} color={colors.accentSoft} />
            </ListIcon>
          }
        />
      </GlassCard>

      <PillButton
        label={t("Se déconnecter")}
        variant="danger"
        icon={LogOut}
        iconPosition="left"
        onPress={onLogout}
        style={styles.logout}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: tint(colors.warning, 0.12),
    marginBottom: spacing(3),
  },
  offlineText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.warning },
  hero: { alignItems: "center" },
  cameraButton: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ctaFrom,
    borderWidth: 3,
    borderColor: colors.bgMid,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginTop: spacing(4),
    textAlign: "center",
  },
  username: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  badges: { flexDirection: "row", gap: 8, marginTop: spacing(3), flexWrap: "wrap", justifyContent: "center" },
  stats: { marginTop: spacing(4) },
  form: { gap: spacing(4) },
  formActions: { flexDirection: "row", gap: spacing(3), marginTop: spacing(1) },
  inlineError: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, marginTop: spacing(2), textAlign: "center" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: spacing(2) },
  savedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.success },
  note: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing(3) },
  noteText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  langOption: {
    flexGrow: 1,
    flexBasis: "45%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.track,
  },
  langOptionActive: { backgroundColor: tint(colors.accent, 0.3), borderColor: tint(colors.accentSoft, 0.55) },
  themeRow: { flexDirection: "row", gap: spacing(2) },
  themeOption: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.track,
  },
  langShort: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.accentSoft },
  langLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
  logout: { marginTop: spacing(8) },
}));
