import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarDays, Clock, X } from "lucide-react-native";
import { createElement, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

import { useT } from "@/i18n";
import { useColorScheme } from "@/theme/scheme";
import { colors, fonts, radius, spacing, themedStyles } from "@/theme/tokens";

import { PillButton } from "./PillButton";

/**
 * Champ de date (ou date et heure) avec calendrier, comme les champs date du web :
 * Android ouvre le sélecteur natif, iPhone une feuille avec calendrier, le web le champ du navigateur.
 * Valeurs échangées en texte local, sans fuseau : « AAAA-MM-JJ » ou « AAAA-MM-JJ HH:MM ».
 */
type Mode = "date" | "datetime";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  mode?: Mode;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Affiche une croix pour vider le champ (dates facultatives). */
  clearable?: boolean;
  error?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

function parse(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

function serialize(d: Date, mode: Mode): string {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return mode === "date" ? day : `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  placeholder,
  minimumDate,
  maximumDate,
  clearable = false,
  error,
}: Props) {
  const { t, locale } = useT();
  const scheme = useColorScheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const current = parse(value);
  const Icon = mode === "date" ? CalendarDays : Clock;

  const display = current
    ? mode === "date"
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(current)
      : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(current)
    : null;

  function open() {
    const start = current ?? (maximumDate && maximumDate < new Date() ? maximumDate : new Date());
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
        mode: "date",
        minimumDate,
        maximumDate,
        onChange: (event: DateTimePickerEvent, picked?: Date) => {
          if (event.type !== "set" || !picked) return;
          if (mode === "date") return onChange(serialize(picked, "date"));
          // Date puis heure, comme deux étapes du même choix.
          DateTimePickerAndroid.open({
            value: start,
            mode: "time",
            is24Hour: true,
            onChange: (e2: DateTimePickerEvent, time?: Date) => {
              if (e2.type !== "set" || !time) return;
              const merged = new Date(picked);
              merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(serialize(merged, "datetime"));
            },
          });
        },
      });
      return;
    }
    setDraft(start);
    setSheetOpen(true);
  }

  const borderColor = error ? colors.danger : colors.glassBorder;

  // Web (Expo web) : champ natif du navigateur, avec son propre calendrier.
  if (Platform.OS === "web") {
    const webValue = mode === "date" ? value : value.replace(" ", "T");
    const toInput = (d?: Date) => (d ? (mode === "date" ? serialize(d, "date") : serialize(d, "datetime").replace(" ", "T")) : undefined);
    return (
      <View style={styles.root}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={[styles.box, { borderColor }]}>
          <Icon size={18} color={colors.textMuted} strokeWidth={2} />
          {createElement("input", {
            type: mode === "date" ? "date" : "datetime-local",
            value: webValue,
            min: toInput(minimumDate),
            max: toInput(maximumDate),
            "aria-label": label ?? placeholder,
            onChange: (e: { target: { value: string } }) => onChange(mode === "date" ? e.target.value : e.target.value.replace("T", " ")),
            style: {
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: colors.text,
              fontFamily: fonts.body,
              fontSize: 15,
              padding: "12px 0",
              colorScheme: scheme,
            },
          })}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? ""} ${display ?? t("Choisir une date")}`.trim()}
        style={({ pressed }) => [styles.box, { borderColor }, pressed && { opacity: 0.85 }]}
      >
        <Icon size={18} color={current ? colors.accentSoft : colors.textMuted} strokeWidth={2} />
        <Text style={[styles.value, !display && styles.placeholder]} numberOfLines={1}>
          {display ?? placeholder ?? t("Choisir une date")}
        </Text>
        {clearable && current ? (
          <Pressable onPress={() => onChange("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Effacer la date")}>
            <X size={18} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        ) : null}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* iPhone : feuille avec calendrier (et heure), validée explicitement. */}
      {Platform.OS === "ios" ? (
        <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)} accessibilityLabel={t("Fermer")} />
          <View style={styles.sheet}>
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <DateTimePicker
              value={draft}
              mode={mode}
              display={mode === "date" ? "inline" : "spinner"}
              locale={locale}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              themeVariant={scheme}
              accentColor={colors.accent}
              onChange={(_e, d) => d && setDraft(d)}
            />
            <View style={styles.actions}>
              <PillButton label={t("Annuler")} variant="ghost" onPress={() => setSheetOpen(false)} style={{ flex: 1 }} />
              <PillButton
                label={t("Valider")}
                onPress={() => {
                  onChange(serialize(draft, mode));
                  setSheetOpen(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary, marginLeft: 4 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.inputBg,
  },
  value: { flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 },
  placeholder: { color: colors.textMuted },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginLeft: 4 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.glassStrong,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(8),
    gap: spacing(3),
  },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.text },
  actions: { flexDirection: "row", gap: spacing(3) },
}));
