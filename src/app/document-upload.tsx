import { router, useLocalSearchParams } from "expo-router";
import { Upload } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { createDriverDocument, uploadFile, type PickedFile } from "@/api/driver";
import { AppHeader, GlassCard, PillButton, Screen, TextField, DateField } from "@/components/ui";
import { useT } from "@/i18n";
import { ChoiceChips } from "@/features/common/ChoiceChips";
import { InlineMessage } from "@/features/common/InlineMessage";
import { PhotoPickerRow } from "@/features/common/PhotoPickerRow";
import { errorMessage, validatePicked } from "@/features/common/media";
import { isIsoDay } from "@/features/declare/datetime";
import { DOC_TYPE_LABELS, DRIVER_DOC_TYPES, docFieldConfig } from "@/features/documents/docTypes";
import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";

/** Dépôt d'une pièce du chauffeur (DocumentUploadDialog du web) : contrôlée avant d'entrer en vigueur. */
export default function DocumentUploadScreen() {
  const { t } = useT();
  const params = useLocalSearchParams<{ targetId: string; docType?: string }>();
  const targetId = params.targetId;
  const [docType, setDocType] = useState<string>(params.docType ?? DRIVER_DOC_TYPES[0]);
  const fields = docFieldConfig(docType);
  const [docNumber, setDocNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [licenseCategories, setLicenseCategories] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!file) return setError(t("Sélectionnez un fichier PDF ou image."));
    const fileError = validatePicked(file);
    if (fileError) return setError(fileError);
    if (fields.expiryMode === "required" && !expiryDate) {
      return setError(t("La date d'expiration est obligatoire pour ce type de document."));
    }
    if ((expiryDate && !isIsoDay(expiryDate)) || (issueDate && !isIsoDay(issueDate))) {
      return setError(t("Date invalide : utilisez le format AAAA-MM-JJ."));
    }
    if (docType === "DRIVING_LICENSE" && !licenseCategories.trim()) {
      return setError(t("Indiquez les catégories du permis (ex. B,C)."));
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadFile(file, "document");
      await createDriverDocument(targetId, {
        driverId: targetId,
        docType,
        docNumber: docNumber || undefined,
        licenseCategories: docType === "DRIVING_LICENSE" && licenseCategories ? licenseCategories.trim().toUpperCase() : undefined,
        issuer: fields.showIssuer && issuer ? issuer : undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || null,
        fileUrl: uploaded.fileUrl,
        fileOriginalName: uploaded.originalName,
        fileMimeType: uploaded.mimeType,
        fileSizeBytes: uploaded.sizeBytes,
        notes: notes || undefined,
      });
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Échec de l'upload."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen header={<AppHeader title={t("Ajouter un document")} onBack={() => router.back()} />}>
      <View style={styles.stack}>
        <Text style={styles.intro}>
          {t("Formats acceptés : PDF, JPEG, PNG, WebP (max 10 Mo).")}{" "}
          {t("La pièce sera contrôlée avant d'entrer en vigueur ; la version actuelle reste valable en attendant.")}
        </Text>
        <GlassCard>
          <View style={styles.stack}>
            <ChoiceChips
              label={t("Type de document")}
              value={docType}
              options={DRIVER_DOC_TYPES.map((v) => ({ value: v, label: t(DOC_TYPE_LABELS[v] ?? v) }))}
              onChange={setDocType}
            />
            <TextField label={t("N° document")} value={docNumber} onChangeText={setDocNumber} placeholder={fields.docNumberPlaceholder ?? "ASS-2026-001"} />
            {fields.showIssuer ? (
              <TextField label={t("Émetteur")} value={issuer} onChangeText={setIssuer} placeholder={fields.issuerPlaceholder ?? "AXA Cameroun"} />
            ) : null}
            <DateField label={t("Date d'émission")} value={issueDate} onChange={setIssueDate} maximumDate={new Date()} clearable />
            {fields.expiryMode !== "hidden" ? (
              <DateField
                label={`${t("Date d'expiration")}${fields.expiryMode === "required" ? " *" : ""}`}
                value={expiryDate}
                onChange={setExpiryDate}
                minimumDate={issueDate ? new Date(`${issueDate}T00:00:00`) : undefined}
                clearable={fields.expiryMode !== "required"}
              />
            ) : null}
            {fields.showLicenseCategories ? (
              <TextField
                label={`${t("Catégories permis")} *`}
                value={licenseCategories}
                onChangeText={setLicenseCategories}
                placeholder="B,C"
                autoCapitalize="characters"
              />
            ) : null}
            <TextField label={t("Notes")} value={notes} onChangeText={setNotes} multiline />
          </View>
        </GlassCard>
        <GlassCard>
          <PhotoPickerRow
            label={t("Fichier")}
            preview={file?.uri ?? null}
            onPicked={(f) => {
              setError(null);
              setFile(f);
            }}
            onClear={() => setFile(null)}
            onError={setError}
          />
        </GlassCard>
        <InlineMessage text={error} />
        <PillButton
          label={submitting ? t("Envoi…") : t("Ajouter un document")}
          icon={Upload}
          size="lg"
          loading={submitting}
          disabled={submitting}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  intro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
}));
