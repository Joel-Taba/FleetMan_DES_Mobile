import { MapPin, Navigation, PackageMinus, PackagePlus, Phone } from "lucide-react-native";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import type { PickedFile } from "@/api/driver";
import type { TripDetailLine, TripStop } from "@/api/types";
import { Badge, GlassCard, IconButton, Stepper, TextField } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { colors, fonts, radius, spacing, themedStyles } from "@/theme/tokens";
import { ChoiceChips } from "../common/ChoiceChips";
import { InlineMessage } from "../common/InlineMessage";
import { PhotoPickerRow } from "../common/PhotoPickerRow";
import { SHORTAGE_REASONS, STOP_FAILURE_REASONS, expectedQty, stopTone } from "../driver/rules";

export type StopMode = "deliver" | "fail" | null;
export type Handled = Record<string, { qty: number; reason: string }>;

/** Arrêt à servir : coordonnées, contact, consignes ; formulaires de livraison et d'échec. */
export function CurrentStopCard({
  stop,
  lines,
  mode,
  handled,
  setHandled,
  recipient,
  setRecipient,
  notes,
  setNotes,
  failure,
  setFailure,
  proofPreview,
  proofBusy,
  onProof,
  onClearProof,
  message,
  onError,
}: {
  stop: TripStop;
  lines: TripDetailLine[];
  mode: StopMode;
  handled: Handled;
  setHandled: (next: Handled) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  failure: string;
  setFailure: (v: string) => void;
  proofPreview: string | null;
  proofBusy: boolean;
  onProof: (file: PickedFile) => void;
  onClearProof: () => void;
  message: { ok: boolean; text: string } | null;
  onError: (text: string) => void;
}) {
  const { t } = useT();
  const pickup = stop.stopType === "PICKUP";
  const hasCoords = stop.latitude != null && stop.longitude != null;

  function openMaps() {
    const dest = `${stop.latitude},${stop.longitude}`;
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${dest}`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    void Linking.openURL(url).catch(() => undefined);
  }

  return (
    <GlassCard strong padding={18}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.typeRow}>
            {pickup ? <PackagePlus size={14} color={colors.accentSoft} /> : <PackageMinus size={14} color={colors.accentSoft} />}
            <Text style={styles.eyebrow}>
              {t("Arrêt")} {stop.sequence} · {codeLabel(stop.stopType, "stopType")}
            </Text>
          </View>
          <Text style={styles.location}>{stop.location}</Text>
          {stop.plannedArrival ? (
            <Text style={styles.small}>
              {t("Prévu")} {formatDateTime(stop.plannedArrival)}
            </Text>
          ) : null}
        </View>
        {hasCoords ? <IconButton icon={Navigation} accessibilityLabel={t("Itinéraire")} onPress={openMaps} /> : null}
      </View>

      <View style={{ flexDirection: "row", marginTop: spacing(2) }}>
        <Badge label={codeLabel(stop.status, "stopStatus")} tone={stopTone(stop.status)} />
      </View>

      {stop.contactName || stop.contactPhone ? (
        <View style={styles.contact}>
          {stop.contactName ? <Text style={styles.contactName}>{stop.contactName}</Text> : null}
          {stop.contactPhone ? (
            <Pressable
              accessibilityRole="link"
              style={styles.phone}
              onPress={() => void Linking.openURL(`tel:${stop.contactPhone}`).catch(() => undefined)}
            >
              <Phone size={14} color={colors.accentSoft} />
              <Text style={styles.phoneText}>{stop.contactPhone}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {stop.instructions ? (
        <View style={styles.instructions}>
          <MapPin size={14} color={colors.textMuted} />
          <Text style={styles.instructionsText}>{stop.instructions}</Text>
        </View>
      ) : null}

      {mode === "deliver" ? (
        <View style={styles.form}>
          {lines.length > 0 ? (
            <View style={{ gap: spacing(3) }}>
              <Text style={styles.label}>{t(pickup ? "Quantités ramassées" : "Quantités livrées")}</Text>
              {lines.map((line) => {
                const id = line.id as string;
                const exp = expectedQty(line);
                const entry = handled[id] ?? { qty: exp, reason: "" };
                return (
                  <View key={id} style={styles.line}>
                    <View style={styles.lineHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineName}>{line.description || codeLabel(line.itemType ?? "")}</Text>
                        <Text style={styles.small}>
                          ({t("prévu")} {exp})
                        </Text>
                      </View>
                      <Stepper
                        value={entry.qty}
                        min={0}
                        max={pickup ? undefined : exp}
                        onChange={(qty) => setHandled({ ...handled, [id]: { ...entry, qty } })}
                      />
                    </View>
                    {entry.qty < exp ? (
                      <ChoiceChips
                        label={t("Motif de l'écart…")}
                        tone="warning"
                        value={entry.reason}
                        options={SHORTAGE_REASONS.map((r) => ({ value: r, label: codeLabel(r, "shortage") }))}
                        onChange={(reason) => setHandled({ ...handled, [id]: { ...entry, reason } })}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          <TextField
            label={`${t("Réceptionnaire")}${pickup ? "" : " *"}`}
            value={recipient}
            onChangeText={setRecipient}
            placeholder={t("Nom de la personne qui réceptionne")}
            autoCapitalize="words"
          />
          <TextField
            label={t("Remarques")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("Réserves, état de la marchandise…")}
            multiline
          />
          <PhotoPickerRow
            label={proofPreview ? t("Preuve jointe : remplacer") : t("Photo de preuve (facultatif)")}
            preview={proofPreview}
            busy={proofBusy}
            onPicked={onProof}
            onClear={onClearProof}
            onError={onError}
          />
        </View>
      ) : null}

      {mode === "fail" ? (
        <View style={styles.form}>
          <ChoiceChips
            label={`${t("Motif")} *`}
            tone="danger"
            value={failure}
            options={STOP_FAILURE_REASONS.map((r) => ({ value: r, label: codeLabel(r, "stopFailure") }))}
            onChange={setFailure}
          />
          <TextField value={notes} onChangeText={setNotes} placeholder={t("Précisions pour le gestionnaire")} multiline />
        </View>
      ) : null}

      {message ? (
        <View style={{ marginTop: spacing(3) }}>
          <InlineMessage text={message.text} tone={message.ok ? "success" : "danger"} />
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = themedStyles(() => ({
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing(3) },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.accentSoft },
  location: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: spacing(1) },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  contact: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing(3), marginTop: spacing(3) },
  contactName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  phone: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  phoneText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.accentSoft },
  instructions: {
    flexDirection: "row",
    gap: spacing(2),
    marginTop: spacing(3),
    padding: spacing(3),
    borderRadius: radius.sm,
    backgroundColor: colors.track,
  },
  instructionsText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  form: { marginTop: spacing(4), gap: spacing(4) },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  line: {
    gap: spacing(3),
    padding: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  lineHead: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  lineName: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
}));
