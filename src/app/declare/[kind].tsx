import { router, useLocalSearchParams } from "expo-router";
import { Camera, Check, ImageIcon, LocateFixed, Paperclip, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ApiError, isQueued } from "@/api/client";
import { addIncidentAttachment, createIncident, uploadFile, type PickedFile } from "@/api/driver";
import { declareFuel, requestMaintenance } from "@/features/declare/api";
import type { IncidentFormValues } from "@/api/types";
import { AppHeader, EmptyState, GlassCard, PillButton, Screen, TextField } from "@/components/ui";
import { useOnline } from "@/hooks/useOnline";
import { tr, useT } from "@/i18n";
import { codeLabel } from "@/i18n/labels";
import { ChoiceChips } from "@/features/common/ChoiceChips";
import { InlineMessage } from "@/features/common/InlineMessage";
import { currentCoords, errorMessage, pickFromLibrary, takePhoto, validatePicked, type Coords } from "@/features/common/media";
import { IncidentForm } from "@/features/declare/IncidentForm";
import { queuedMessage } from "@/features/offline/hooks";
import { pushRecent } from "@/features/declare/recent";
import { useDriverId, useDriverProfile } from "@/features/driver/hooks";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

type Kind = "incident" | "fuel" | "maintenance";

const CONFIG: Record<Kind, { title: string; submit: string }> = {
  incident: { title: "Signaler un incident", submit: "Envoyer le signalement" },
  fuel: { title: "Déclarer un plein", submit: "Enregistrer le plein" },
  maintenance: { title: "Signaler une maintenance", submit: "Envoyer la demande" },
};

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Formulaires terrain (DriverDeclarationForm du web) : incident, plein, maintenance. */
export default function DeclarationFormScreen() {
  const { t } = useT();
  const { kind: rawKind } = useLocalSearchParams<{ kind: string }>();
  const kind = (["incident", "fuel", "maintenance"].includes(rawKind ?? "") ? rawKind : null) as Kind | null;
  const driverId = useDriverId();
  const profile = useDriverProfile();
  const online = useOnline();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  // Saved in the offline queue (no network): sent automatically when the network returns.
  const [queued, setQueued] = useState(false);

  // Plein
  const [liters, setLiters] = useState("");
  const [amount, setAmount] = useState("");
  const [station, setStation] = useState("");
  const [odometer, setOdometer] = useState("");
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  // Maintenance
  const [mType, setMType] = useState("CORRECTIVE");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState<"Non" | "Oui">("Non");
  // Position (plein, maintenance)
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const header = <AppHeader title={kind ? t(CONFIG[kind].title) : t("Déclarations terrain")} onBack={() => router.back()} />;

  if (!kind) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t("Formulaire introuvable.")} />
      </Screen>
    );
  }

  /** Véhicule attitré du chauffeur, comme le web (resolveDriverContext). */
  function vehicleId(): string {
    const id = profile.data?.assignedVehicleId;
    if (!id) throw new Error(tr("Aucun véhicule assigné : impossible d'enregistrer la déclaration."));
    return id;
  }

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      setCoords(await currentCoords());
    } catch (err) {
      setError(errorMessage(err, "Position indisponible."));
    } finally {
      setLocating(false);
    }
  }

  async function pickReceipt(source: "camera" | "library") {
    setError(null);
    try {
      const file = source === "camera" ? await takePhoto() : await pickFromLibrary();
      if (!file) return;
      const invalid = validatePicked(file);
      if (invalid) return setError(invalid);
      setReceipt(file);
    } catch (err) {
      setError(errorMessage(err, "Action impossible."));
    }
  }

  async function submitIncident(values: IncidentFormValues, photos: PickedFile[]) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createIncident({ ...values, vehicleId: vehicleId(), driverId, reportedBy: driverId });
      if (isQueued(result)) {
        // Offline: the incident waits in the queue; photos need the network (added later from the case).
        setQueued(true);
        await pushRecent(driverId, {
          id: result.clientId,
          kind: "incident",
          label: `${codeLabel(values.type)} · ${codeLabel(values.severity ?? "MEDIUM")}`,
          status: "PENDING",
          at: new Date().toISOString(),
        });
        if (photos.length > 0) setWarning(t("Photos non envoyées hors ligne : ajoutez-les depuis le dossier une fois connecté."));
        setSubmitted(true);
        return;
      }
      const created = result;
      setIncidentId(created?.id ?? null);
      await pushRecent(driverId, {
        id: created?.id ?? String(Date.now()),
        kind: "incident",
        label: `${codeLabel(values.type)} · ${codeLabel(values.severity ?? "MEDIUM")}`,
        status: created?.status ?? "REPORTED",
        at: new Date().toISOString(),
      });
      // Photos jointes au dossier une fois l'incident créé.
      let failed = 0;
      for (const photo of created?.id ? photos : []) {
        try {
          const up = await uploadFile(photo, "document");
          await addIncidentAttachment(created.id, {
            kind: photo.mimeType.startsWith("image/") ? "PHOTO" : "REPORT",
            fileUrl: up.fileUrl,
            fileName: up.originalName,
            mimeType: up.mimeType,
            sizeBytes: up.sizeBytes,
          });
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) setWarning(`${failed} ${t("photo(s) non envoyée(s) : ajoutez-les depuis le dossier.")}`);
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err, "Échec de l'envoi."));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOther() {
    setError(null);
    if (kind === "fuel") {
      const q = toNumber(liters);
      const p = toNumber(amount);
      if (q == null || q <= 0) return setError(t("La quantité doit être strictement positive."));
      if (p == null || p < 0) return setError(t("Le prix ne peut pas être négatif."));
      if (!station.trim()) return setError(t("Indiquez la station-service."));
      const km = toNumber(odometer);
      if (odometer.trim() && (km == null || km < 0)) return setError(t("Kilométrage invalide."));
      setSubmitting(true);
      try {
        const vid = vehicleId();
        // Ticket : envoyé d'abord, puis joint au plein (le plein part même si l'envoi échoue).
        let uploaded: { fileUrl: string; originalName?: string; mimeType?: string } | null = null;
        if (receipt) {
          try {
            uploaded = await uploadFile(receipt, "expense-receipt");
          } catch (err) {
            // Files are never queued offline: the refuel leaves without its receipt.
            const offline = err instanceof ApiError && err.status === 0;
            setWarning(
              offline
                ? t("Hors ligne : ticket non joint, le plein est enregistré sans photo.")
                : t("Ticket non envoyé : le plein est enregistré sans photo.")
            );
          }
        }
        // Le serveur attribue le plein au chauffeur, met à jour le compteur et notifie le gestionnaire.
        const result = await declareFuel({
          quantity: q,
          price: p,
          vehicleId: vid,
          stationName: station.trim(),
          odometerKm: km ?? undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          receiptUrl: uploaded?.fileUrl,
          receiptName: uploaded?.originalName,
          receiptMime: uploaded?.mimeType,
        });
        const created = isQueued(result) ? null : result;
        if (isQueued(result)) setQueued(true);
        await pushRecent(driverId, {
          id: created?.id ?? (isQueued(result) ? result.clientId : String(Date.now())),
          kind: "fuel",
          label: `${t("Plein")} · ${q} L`,
          status: created?.expenseStatus ?? "PENDING",
          at: new Date().toISOString(),
        });
        setSubmitted(true);
      } catch (err) {
        setError(errorMessage(err, "Échec de l'envoi."));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!description.trim()) return setError(t("Décrivez le problème."));
    setSubmitting(true);
    try {
      const title = subject.trim() || codeLabel(mType);
      const result = await requestMaintenance({
        subject: title,
        report: description.trim(),
        vehicleId: vehicleId(),
        maintenanceType: mType,
        urgent: urgent === "Oui",
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      const created = isQueued(result) ? null : result;
      if (isQueued(result)) setQueued(true);
      await pushRecent(driverId, {
        id: created?.id ?? (isQueued(result) ? result.clientId : String(Date.now())),
        kind: "maintenance",
        label: title,
        status: isQueued(result) ? "PENDING" : (created?.status ?? "REQUESTED"),
        at: new Date().toISOString(),
      });
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
          <Text style={styles.doneTitle}>{queued ? t("Déclaration enregistrée hors ligne") : t("Déclaration envoyée")}</Text>
          <Text style={styles.doneText}>{queued ? queuedMessage() : t("Votre gestionnaire sera notifié sous peu.")}</Text>
          {warning ? <InlineMessage text={warning} tone="warning" /> : null}
          <View style={{ alignSelf: "stretch", gap: spacing(3), marginTop: spacing(4) }}>
            {kind === "incident" && incidentId && online ? (
              <PillButton
                label={t("Ajouter des photos au dossier")}
                onPress={() => router.replace({ pathname: "/incident/[id]", params: { id: incidentId } })}
              />
            ) : null}
            <PillButton label={t("Retour aux déclarations")} variant="glass" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  const noVehicle = !profile.loading && profile.data && !profile.data.assignedVehicleId;

  return (
    <Screen header={header}>
      <View style={styles.stack}>
        {noVehicle ? <InlineMessage text={t("Aucun véhicule assigné : impossible d'enregistrer la déclaration.")} tone="warning" /> : null}
        {kind === "incident" ? (
          <IncidentForm
            onSubmit={(values, photos) => void submitIncident(values, photos)}
            submitting={submitting}
            error={error}
            submitLabel={t(CONFIG.incident.submit)}
          />
        ) : (
          <>
            <GlassCard>
              <View style={styles.stack}>
                {kind === "fuel" ? (
                  <>
                    <TextField label={`${t("Litres")} *`} value={liters} onChangeText={setLiters} keyboardType="decimal-pad" placeholder="50" />
                    <TextField label={`${t("Montant (XAF)")} *`} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="37500" />
                    <TextField label={`${t("Station-service")} *`} value={station} onChangeText={setStation} placeholder="TOTAL" />
                    <TextField label={t("Kilométrage")} value={odometer} onChangeText={setOdometer} keyboardType="numeric" />
                    <Text style={styles.fieldLabel}>{t("Photo du ticket")}</Text>
                    {receipt ? (
                      <View style={styles.coords}>
                        <Paperclip size={16} color={colors.success} />
                        <Text style={styles.coordsText} numberOfLines={1}>{receipt.name}</Text>
                        <Pressable accessibilityLabel={t("Retirer")} onPress={() => setReceipt(null)}>
                          <X size={16} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.receiptRow}>
                        <View style={{ flex: 1 }}>
                          <PillButton label={t("Photo")} icon={Camera} iconPosition="left" variant="glass" onPress={() => void pickReceipt("camera")} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PillButton label={t("Galerie")} icon={ImageIcon} iconPosition="left" variant="glass" onPress={() => void pickReceipt("library")} />
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <ChoiceChips
                      label={t("Type")}
                      value={mType}
                      options={["PREVENTIVE", "CORRECTIVE", "EMERGENCY"].map((v) => ({ value: v, label: codeLabel(v) }))}
                      onChange={setMType}
                    />
                    <TextField label={t("Objet")} value={subject} onChangeText={setSubject} placeholder={t("Ex : bruit au freinage")} />
                    <TextField label={`${t("Description du problème")} *`} value={description} onChangeText={setDescription} multiline />
                    <ChoiceChips
                      label={t("Urgent ?")}
                      value={urgent}
                      tone={urgent === "Oui" ? "danger" : "accent"}
                      options={[
                        { value: "Non", label: t("Non") },
                        { value: "Oui", label: t("Oui") },
                      ]}
                      onChange={setUrgent}
                    />
                  </>
                )}
              </View>
            </GlassCard>
            <GlassCard>
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
            </GlassCard>
            <InlineMessage text={error} />
            <PillButton
              label={submitting ? t("Envoi…") : t(CONFIG[kind].submit)}
              size="lg"
              loading={submitting}
              disabled={submitting}
              onPress={() => void submitOther()}
            />
            <Text style={styles.caption}>{t("Votre gestionnaire sera notifié sous peu.")}</Text>
          </>
        )}
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
  coords: { flexDirection: "row", alignItems: "center", gap: spacing(2), padding: spacing(1), borderRadius: radius.sm },
  coordsText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  receiptRow: { flexDirection: "row", gap: spacing(3) },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: "center" },
}));
