import { router } from "expo-router";
import { Banknote, Check, ReceiptText } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { createExpense, uploadFile, type PickedFile } from "@/api/driver";
import type { ManualExpenseType } from "@/api/types";
import { AppHeader, GlassCard, LicensePlate, PillButton, Screen, TextField, DateField } from "@/components/ui";
import { useOnline } from "@/hooks/useOnline";
import { tr, useT } from "@/i18n";
import { ChoiceChips } from "@/features/common/ChoiceChips";
import { InlineMessage } from "@/features/common/InlineMessage";
import { PhotoPickerRow } from "@/features/common/PhotoPickerRow";
import { errorMessage, validatePicked } from "@/features/common/media";
import { parseLocalDateTime } from "@/features/declare/datetime";
import { EXPENSE_TYPE_LABEL, MANUAL_EXPENSE_TYPES, rememberExpense } from "@/features/declare/expenses";
import { pushRecent } from "@/features/declare/recent";
import { useDriverActiveTrip, useDriverId, useDriverProfile, useDriverVehicle } from "@/features/driver/hooks";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

const pad = (n: number) => String(n).padStart(2, "0");

/** Maintenant, au format saisi « AAAA-MM-JJ HH:MM » (heure locale). */
function nowInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toAmount(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Dépense terrain du chauffeur (péage, amende, autre) : validée ensuite par son gestionnaire. */
export default function ExpenseDeclarationScreen() {
  const { t } = useT();
  const driverId = useDriverId();
  const profile = useDriverProfile();
  const activeTrip = useDriverActiveTrip();
  const online = useOnline();

  const [type, setType] = useState<ManualExpenseType>("TOLL");
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState(nowInput);
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Même règle que le serveur : véhicule attitré, sinon celui du trajet en cours.
  const vehicleId = profile.data?.assignedVehicleId || activeTrip.data?.vehicleId || null;
  const vehicle = useDriverVehicle(vehicleId);
  const noVehicle = !profile.loading && !activeTrip.loading && profile.data !== undefined && !vehicleId;

  const header = <AppHeader title={t("Déclarer une dépense")} onBack={() => router.back()} />;

  function pickReceipt(file: PickedFile) {
    const invalid = validatePicked(file);
    if (invalid) return setError(invalid);
    setError(null);
    setReceipt(file);
  }

  async function submit() {
    setError(null);
    setWarning(null);
    const value = toAmount(amount);
    if (value == null || value <= 0) return setError(t("Le montant doit être strictement positif."));
    const date = parseLocalDateTime(when);
    if (!date) return setError(t("Date invalide."));
    if (new Date(date).getTime() > Date.now() + 5 * 60 * 1000) return setError(t("La date de la dépense ne peut pas être dans le futur."));
    if (type === "OTHER" && !description.trim()) return setError(t("Décrivez la dépense (nature, lieu) pour une dépense « Autre »."));
    if (!vehicleId) return setError(t("Aucun véhicule assigné : impossible d'enregistrer la déclaration."));
    setSubmitting(true);
    try {
      // Justificatif envoyé d'abord ; la dépense part même si l'envoi échoue (à joindre ensuite).
      let uploaded: { fileUrl: string; originalName?: string; mimeType?: string } | null = null;
      if (receipt) {
        try {
          uploaded = await uploadFile(receipt, "expense-receipt");
        } catch {
          setWarning(t("Justificatif non envoyé : la dépense est enregistrée sans photo."));
        }
      }
      const created = await createExpense({
        expenseType: type,
        amount: value,
        vehicleId,
        description: description.trim() || undefined,
        expenseDate: date,
        receiptUrl: uploaded?.fileUrl,
        receiptName: uploaded?.originalName,
        receiptMime: uploaded?.mimeType,
      });
      if (created?.id) {
        await rememberExpense(driverId, created.id);
        await pushRecent(driverId, {
          id: created.id,
          kind: "expense",
          label: `${tr(EXPENSE_TYPE_LABEL[type])} · ${value.toLocaleString()} XAF`,
          status: created.status ?? "PENDING",
          at: new Date().toISOString(),
        });
      }
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err, "Échec de l'envoi."));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Screen header={header}>
        <View style={styles.done}>
          <View style={styles.doneIcon}>
            <Check size={40} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>{t("Dépense envoyée")}</Text>
          <Text style={styles.doneText}>{t("Dépense envoyée à votre gestionnaire pour validation.")}</Text>
          <Text style={styles.doneText}>{t("Suivez sa réponse dans « Mes déclarations récentes ».")}</Text>
          {warning ? <InlineMessage text={warning} tone="warning" /> : null}
          <View style={{ alignSelf: "stretch", marginTop: spacing(4) }}>
            <PillButton label={t("Retour aux déclarations")} variant="glass" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <View style={styles.stack}>
        {noVehicle ? <InlineMessage text={t("Aucun véhicule assigné : impossible d'enregistrer la déclaration.")} tone="warning" /> : null}
        {!online ? <InlineMessage text={t("Hors ligne : la dépense pourra être envoyée une fois la connexion rétablie.")} tone="warning" /> : null}

        {vehicleId ? (
          <GlassCard>
            <View style={styles.vehicleRow}>
              <View style={styles.vehicleIcon}>
                <Banknote size={20} color={colors.accentSoft} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldLabel}>{t("Véhicule concerné")}</Text>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {[vehicle.data?.brand, vehicle.data?.model].filter(Boolean).join(" ") || t("Véhicule attitré")}
                </Text>
              </View>
              {vehicle.data?.licensePlate ? <LicensePlate plate={vehicle.data.licensePlate} size="sm" /> : null}
            </View>
          </GlassCard>
        ) : null}

        <GlassCard>
          <View style={styles.stack}>
            <ChoiceChips
              label={t("Type de dépense")}
              value={type}
              options={MANUAL_EXPENSE_TYPES.map((v) => ({ value: v, label: t(EXPENSE_TYPE_LABEL[v]) }))}
              onChange={setType}
            />
            <TextField
              label={`${t("Montant (XAF)")} *`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="2500"
            />
            <DateField label={`${t("Date et heure")} *`} value={when} onChange={setWhen} mode="datetime" maximumDate={new Date()} />
            <TextField
              label={type === "OTHER" ? `${t("Description")} *` : t("Description")}
              value={description}
              onChangeText={setDescription}
              placeholder={type === "TOLL" ? t("Ex : péage d'Edéa") : type === "FINE" ? t("Ex : stationnement, Akwa") : t("Nature et lieu de la dépense")}
              multiline
            />
          </View>
        </GlassCard>

        <GlassCard>
          <View style={{ gap: spacing(2) }}>
            <View style={styles.receiptHead}>
              <ReceiptText size={16} color={colors.textSecondary} />
              <Text style={styles.fieldLabel}>{t("Photo du justificatif")}</Text>
            </View>
            <Text style={styles.hint}>{t("Le justificatif est exigé pour que la dépense soit validée.")}</Text>
            <PhotoPickerRow
              preview={receipt && receipt.mimeType.startsWith("image/") ? receipt.uri : null}
              busy={submitting}
              onPicked={pickReceipt}
              onClear={() => setReceipt(null)}
              onError={setError}
            />
            {receipt && !receipt.mimeType.startsWith("image/") ? <Text style={styles.hint}>{receipt.name}</Text> : null}
          </View>
        </GlassCard>

        <InlineMessage text={error} />
        <PillButton
          label={submitting ? t("Envoi…") : t("Envoyer la dépense")}
          size="lg"
          loading={submitting}
          disabled={submitting || !vehicleId}
          onPress={() => void submit()}
        />
        <Text style={styles.caption}>{t("Votre gestionnaire valide ou refuse la dépense ; vous êtes notifié de sa décision.")}</Text>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(2), paddingTop: spacing(16) },
  doneIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint(colors.success, 0.15),
    marginBottom: spacing(2),
  },
  doneTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  doneText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint(colors.accent, 0.14),
  },
  vehicleName: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text, marginTop: 2 },
  receiptHead: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  fieldLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: "center" },
}));
