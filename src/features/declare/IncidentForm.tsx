import { Image } from "expo-image";
import { LocateFixed, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PickedFile } from "@/api/driver";
import type { IncidentFormValues } from "@/api/types";
import { GlassCard, PillButton, Stepper, TextField, DateField } from "@/components/ui";
import { useT } from "@/i18n";
import { codeLabel } from "@/i18n/labels";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";
import { CheckRow } from "../common/CheckRow";
import { ChoiceChips } from "../common/ChoiceChips";
import { InlineMessage } from "../common/InlineMessage";
import { PhotoPickerRow } from "../common/PhotoPickerRow";
import { currentCoords, validatePicked, type Coords } from "../common/media";
import { parseLocalDateTime } from "./datetime";

const TYPES = ["ACCIDENT", "BREAKDOWN", "THEFT", "VANDALISM", "TRAFFIC_VIOLATION", "OTHER"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * Déclaration d'un incident (IncidentDeclareForm du web) : le terrain d'abord, le reste
 * s'instruit après. Le mobile ajoute la position GPS et des photos jointes au dossier.
 */
export function IncidentForm({
  onSubmit,
  submitting,
  error,
  submitLabel,
}: {
  onSubmit: (values: IncidentFormValues, photos: PickedFile[]) => void;
  submitting: boolean;
  error?: string | null;
  submitLabel: string;
}) {
  const { t } = useT();
  const [type, setType] = useState("BREAKDOWN");
  const [severity, setSeverity] = useState("MEDIUM");
  const [occurredAt, setOccurredAt] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [description, setDescription] = useState("");
  const [drivable, setDrivable] = useState(true);
  const [injuries, setInjuries] = useState(false);
  const [injuriesCount, setInjuriesCount] = useState(1);
  const [third, setThird] = useState(false);
  const [thirdName, setThirdName] = useState("");
  const [thirdPlate, setThirdPlate] = useState("");
  const [thirdInsurer, setThirdInsurer] = useState("");
  const [thirdContact, setThirdContact] = useState("");
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  async function locate() {
    setLocating(true);
    setLocalError(null);
    try {
      setCoords(await currentCoords());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("Position indisponible."));
    } finally {
      setLocating(false);
    }
  }

  function addPhoto(file: PickedFile) {
    const problem = validatePicked(file);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    setPhotos((list) => [...list, file].slice(0, 6));
  }

  function submit() {
    setLocalError(null);
    if (!description.trim()) {
      setLocalError(t("Décrivez ce qui s'est passé."));
      return;
    }
    let when: string | undefined;
    if (occurredAt.trim()) {
      const parsed = parseLocalDateTime(occurredAt);
      if (!parsed) {
        setLocalError(t("Date invalide."));
        return;
      }
      when = parsed;
    }
    const withPeople = type === "ACCIDENT" || type === "VANDALISM";
    onSubmit(
      {
        type,
        severity,
        description: description.trim(),
        occurredAt: when,
        locationLabel: location.trim() || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        vehicleDrivable: drivable,
        injuries: (withPeople && injuries) || undefined,
        injuriesCount: withPeople && injuries ? injuriesCount : undefined,
        thirdPartyInvolved: (withPeople && third) || undefined,
        thirdPartyName: withPeople && third && thirdName ? thirdName : undefined,
        thirdPartyPlate: withPeople && third && thirdPlate ? thirdPlate : undefined,
        thirdPartyInsurer: withPeople && third && thirdInsurer ? thirdInsurer : undefined,
        thirdPartyContact: withPeople && third && thirdContact ? thirdContact : undefined,
      },
      photos
    );
  }

  return (
    <View style={styles.stack}>
      <GlassCard>
        <View style={styles.stack}>
          <ChoiceChips label={t("Type *")} value={type} options={TYPES.map((v) => ({ value: v, label: codeLabel(v) }))} onChange={setType} />
          <ChoiceChips
            label={t("Gravité")}
            value={severity}
            tone={severity === "CRITICAL" || severity === "HIGH" ? "danger" : "accent"}
            options={SEVERITIES.map((v) => ({ value: v, label: codeLabel(v) }))}
            onChange={setSeverity}
          />
          <TextField label={t("Que s'est-il passé ? *")} value={description} onChangeText={setDescription} multiline />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.stack}>
          <DateField
            label={t("Date et heure (si ce n'est pas maintenant)")}
            value={occurredAt}
            onChange={setOccurredAt}
            mode="datetime"
            maximumDate={new Date()}
            placeholder={t("Maintenant")}
            clearable
          />
          <TextField label={t("Lieu")} value={location} onChangeText={setLocation} placeholder={t("Carrefour, route, ville…")} />
          {coords ? (
            <View style={styles.coords}>
              <LocateFixed size={16} color={colors.success} />
              <Text style={styles.coordsText}>
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
              <Pressable accessibilityLabel={t("Retirer")} onPress={() => setCoords(null)}>
                <X size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <PillButton
              label={t("Joindre ma position")}
              icon={LocateFixed}
              iconPosition="left"
              variant="glass"
              loading={locating}
              disabled={locating}
              onPress={() => void locate()}
            />
          )}
        </View>
      </GlassCard>

      <CheckRow
        checked={!drivable}
        onChange={(c) => setDrivable(!c)}
        title={t("Le véhicule ne peut plus rouler")}
        subtitle={t("Il sera immobilisé et la mission en cours interrompue.")}
      />

      {type === "ACCIDENT" || type === "VANDALISM" ? (
        <GlassCard>
          <View style={styles.stack}>
            <CheckRow checked={injuries} onChange={setInjuries} title={t("Il y a des blessés")} />
            {injuries ? (
              <View style={styles.qty}>
                <Text style={styles.label}>{t("Nombre de blessés")}</Text>
                <Stepper value={injuriesCount} min={1} onChange={setInjuriesCount} />
              </View>
            ) : null}
            <CheckRow checked={third} onChange={setThird} title={t("Un tiers est impliqué")} />
            {third ? (
              <>
                <TextField label={t("Nom du tiers")} value={thirdName} onChangeText={setThirdName} />
                <TextField label={t("Immatriculation")} value={thirdPlate} onChangeText={setThirdPlate} autoCapitalize="characters" />
                <TextField label={t("Son assureur")} value={thirdInsurer} onChangeText={setThirdInsurer} />
                <TextField label={t("Son contact")} value={thirdContact} onChangeText={setThirdContact} keyboardType="phone-pad" />
              </>
            ) : null}
          </View>
        </GlassCard>
      ) : null}

      <GlassCard>
        <View style={styles.stack}>
          <Text style={styles.label}>{t("Photos et pièces")}</Text>
          {photos.length > 0 ? (
            <View style={styles.thumbs}>
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`} style={styles.thumb}>
                  <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <Pressable
                    accessibilityLabel={t("Retirer")}
                    style={styles.thumbClear}
                    onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  >
                    <X size={14} color={colors.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <PhotoPickerRow onPicked={addPhoto} onError={setLocalError} />
        </View>
      </GlassCard>

      <InlineMessage text={localError ?? error} />
      <PillButton label={submitting ? t("Envoi…") : submitLabel} size="lg" loading={submitting} disabled={submitting} onPress={submit} />
    </View>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  qty: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coords: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    padding: spacing(3),
    borderRadius: radius.sm,
    backgroundColor: tint(colors.success, 0.1),
  },
  coordsText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  thumb: { width: 88, height: 88, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.glass },
  thumbClear: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
}));
