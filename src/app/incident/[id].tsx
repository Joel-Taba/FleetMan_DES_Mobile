import { router, useLocalSearchParams } from "expo-router";
import { Ban, CheckCircle2, Circle, HelpCircle, MapPin, Send } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AppState, Linking, Pressable, Text, View } from "react-native";
import { isQueued } from "@/api/client";
import { addIncidentAttachment, commentIncident, fetchIncidentThread, uploadFile, type PickedFile } from "@/api/driver";
import type { IncidentCaseThread } from "@/api/types";
import {
  AppHeader,
  Badge,
  Divider,
  ErrorState,
  GlassCard,
  LicensePlate,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
  TextField,
} from "@/components/ui";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useT } from "@/i18n";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { InlineMessage } from "@/features/common/InlineMessage";
import { PhotoPickerRow } from "@/features/common/PhotoPickerRow";
import { SecureImage } from "@/features/common/SecureImage";
import { errorMessage, validatePicked } from "@/features/common/media";
import { queuedMessage } from "@/features/offline/hooks";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

const STEPS = ["REPORTED", "ACKNOWLEDGED", "UNDER_INVESTIGATION", "RESOLVED", "CLOSED"];
const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Déclaré",
  ACKNOWLEDGED: "Pris en charge",
  UNDER_INVESTIGATION: "En traitement",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
  CANCELLED: "Annulé",
};
const STATUS_TONE: Record<string, "warning" | "default" | "success" | "muted"> = {
  REPORTED: "warning",
  ACKNOWLEDGED: "default",
  UNDER_INVESTIGATION: "default",
  RESOLVED: "success",
  CLOSED: "success",
  CANCELLED: "muted",
};
const EVENT_LABEL: Record<string, string> = {
  DECLARED: "Incident déclaré",
  UPDATED: "Dossier mis à jour",
  ATTACHMENT_ADDED: "Pièce ajoutée",
  COST_ADDED: "Coût ajouté",
  IMMOBILIZED: "Véhicule immobilisé",
  RELEASED: "Véhicule libéré",
  REPAIR_ORDER: "Ordre de réparation ouvert",
  COMMENT: "Message du gestionnaire",
  INFO_REQUESTED: "Information demandée",
  DRIVER_COMMENT: "Mon message",
  INFO_PROVIDED: "Ma réponse",
};
const MESSAGE_EVENTS = ["COMMENT", "INFO_REQUESTED", "DRIVER_COMMENT", "INFO_PROVIDED"];

function eventTitle(e: IncidentCaseThread["timeline"][number]) {
  if (e.type === "STATUS_CHANGED" && e.toStatus) {
    if (e.fromStatus === "RESOLVED" && e.toStatus === "UNDER_INVESTIGATION") return "Dossier rouvert";
    return STATUS_LABEL[e.toStatus] ?? e.toStatus;
  }
  return EVENT_LABEL[e.type] ?? e.type;
}
const LABEL: Record<string, string> = {
  NONE: "Aucune",
  DECLARED: "Déclaré",
  IN_PROGRESS: "En cours",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  DRIVER: "Chauffeur",
  THIRD_PARTY: "Tiers",
  UNDETERMINED: "À établir",
};
const money = (v: number | null | undefined) => (v == null ? "-" : `${formatNumber(Number(v))} XAF`);

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value === null || value === undefined || value === "" ? "-" : String(value)}</Text>
    </View>
  );
}

/**
 * Dossier d'un incident côté chauffeur : avancement, échanges avec le gestionnaire (message, réponse
 * à une demande d'information), photos. Relu au retour au premier plan.
 */
export default function IncidentScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApiQuery<IncidentCaseThread>(`driver:incident:${id}`, () => fetchIncidentThread(id), [id], { enabled: Boolean(id) });
  const [override, setOverride] = useState<IncidentCaseThread | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const view = override ?? query.data;
  const { refetch } = query;

  // Une décision du gestionnaire prise pendant que l'app était en arrière-plan est visible au retour.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setOverride(null);
        void refetch();
      }
    });
    return () => sub.remove();
  }, [refetch]);

  async function send() {
    const text = message.trim();
    if (!text) {
      setActionError(t("Écrivez votre message."));
      return;
    }
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await commentIncident(id, text);
      // Offline: the message waits in the queue and the case is reloaded once it is sent.
      if (isQueued(result)) setNotice(queuedMessage());
      else setOverride(result);
      setMessage("");
    } catch (err) {
      setActionError(errorMessage(err, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function attach(file: PickedFile) {
    const problem = validatePicked(file);
    if (problem) {
      setActionError(problem);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const up = await uploadFile(file, "document");
      const next = await addIncidentAttachment(id, {
        kind: file.mimeType.startsWith("image/") ? "PHOTO" : "REPORT",
        fileUrl: up.fileUrl,
        fileName: up.originalName,
        mimeType: up.mimeType,
        sizeBytes: up.sizeBytes,
      });
      if (next) setOverride(next as IncidentCaseThread);
      else await query.refetch();
    } catch (err) {
      setActionError(errorMessage(err, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  const header = <AppHeader title={t("Incidents")} subtitle={view ? codeLabel(view.incident.type) : undefined} onBack={() => router.back()} />;

  if (!view) {
    return (
      <Screen header={header}>
        {query.loading ? <LoadingState /> : <ErrorState message={query.error ?? t("Action impossible.")} onRetry={() => void query.refetch()} />}
      </Screen>
    );
  }

  const inc = view.incident;
  const d = view.details;
  const status = inc.status;
  const frozen = status === "CLOSED" || status === "CANCELLED";
  const stepIndex = STEPS.indexOf(status);
  const pending = view.pendingInfoRequest;
  const coords = inc.location && inc.location.latitude != null && inc.location.longitude != null ? inc.location : null;

  return (
    <Screen
      header={header}
      refreshing={query.refreshing}
      onRefresh={() => {
        setOverride(null);
        void query.refetch();
      }}
    >
      <View style={styles.stack}>
        <GlassCard strong padding={20} style={inc.isCritical ? { borderColor: tint(colors.danger, 0.5) } : undefined}>
          <Text style={styles.small}>{formatDateTime(inc.incidentDateTime)}</Text>
          <Text style={styles.title}>{codeLabel(inc.type)}</Text>
          {inc.description ? <Text style={styles.body}>{inc.description}</Text> : null}
          <View style={styles.badges}>
            <LicensePlate plate={inc.vehicleRegistration ?? "-"} />
            <Badge label={t(STATUS_LABEL[status] ?? status)} tone={STATUS_TONE[status] ?? "muted"} />
            <Badge label={codeLabel(inc.severity)} tone={inc.isCritical ? "danger" : "muted"} />
            {view.vehicleImmobilized ? <Badge label={t("Véhicule immobilisé")} tone="danger" /> : null}
            {!view.vehicleDrivable ? <Badge label={t("Non roulant")} tone="warning" /> : null}
          </View>
        </GlassCard>

        {pending != null && !frozen ? (
          <GlassCard style={{ borderColor: tint(colors.warning, 0.5) }}>
            <View style={styles.inline}>
              <HelpCircle size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{t("Votre gestionnaire vous demande une information")}</Text>
                {pending ? <Text style={styles.body}>{pending}</Text> : null}
                <Text style={styles.small}>{t("Répondez ci-dessous ou ajoutez une photo.")}</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <GlassCard>
          {status === "CANCELLED" ? (
            <View style={styles.inline}>
              <Ban size={18} color={colors.textMuted} />
              <Text style={[styles.body, { flex: 1, marginTop: 0 }]}>
                {t("Dossier annulé")} : {d.cancelReason}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing(3) }}>
              {STEPS.map((s, i) => (
                <View key={s} style={styles.inline}>
                  {i <= stepIndex ? <CheckCircle2 size={18} color={colors.accentSoft} /> : <Circle size={18} color={colors.textMuted} />}
                  <Text style={[styles.step, i <= stepIndex && { color: colors.text, fontFamily: fonts.bodySemibold }]}>{t(STATUS_LABEL[s] ?? s)}</Text>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        {!frozen ? (
          <>
            <SectionHeader title={t("Écrire au gestionnaire")} />
            <GlassCard>
              <View style={{ gap: spacing(3) }}>
                <TextField
                  label={pending != null ? t("Votre réponse") : t("Votre message")}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={pending != null ? t("Votre réponse…") : t("Une précision sur l'incident…")}
                  multiline
                />
                <PillButton
                  label={pending != null ? t("Envoyer la réponse") : t("Envoyer")}
                  icon={Send}
                  loading={busy}
                  disabled={busy || !message.trim()}
                  onPress={() => void send()}
                />
                <InlineMessage text={notice} tone="info" />
              </View>
            </GlassCard>
          </>
        ) : null}

        <SectionHeader title={t("Faits")} />
        <GlassCard>
          <Fact label={t("Lieu")} value={d.locationLabel} />
          {coords ? (
            <>
              <Divider />
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=16/${coords.latitude}/${coords.longitude}`)}
                style={[styles.fact, styles.inline]}
              >
                <MapPin size={16} color={colors.accentSoft} />
                <Text style={styles.factValue}>
                  {Number(coords.latitude).toFixed(5)}, {Number(coords.longitude).toFixed(5)}
                </Text>
              </Pressable>
            </>
          ) : null}
          <Divider />
          <Fact label={t("Chauffeur")} value={inc.driverFullName} />
          <Divider />
          <Fact label={t("Déclaré par")} value={view.reportedByName ?? inc.reportedBy} />
          <Divider />
          <Fact label={t("Responsable du dossier")} value={view.handlerName} />
          <Divider />
          <Fact label={t("Trajet en cours")} value={view.tripCode} />
          <Divider />
          <Fact label={t("Véhicule")} value={view.vehicleDrivable ? t("Roulant") : t("Non roulant")} />
          <Divider />
          <Fact label={t("Blessés")} value={d.injuries ? (d.injuriesCount ?? t("Oui")) : t("Non")} />
          <Divider />
          <Fact label={t("Responsabilité")} value={t(LABEL[d.responsibility] ?? d.responsibility)} />
          {d.thirdPartyInvolved ? (
            <>
              <Divider />
              <Fact label={t("Tiers")} value={[d.thirdPartyName, d.thirdPartyPlate, d.thirdPartyInsurer, d.thirdPartyContact].filter(Boolean).join(" · ")} />
            </>
          ) : null}
          {inc.policeReportNumber ? (
            <>
              <Divider />
              <Fact label={inc.type === "THEFT" ? t("Numéro de plainte") : t("Constat ou procès-verbal")} value={inc.policeReportNumber} />
            </>
          ) : null}
          <Divider />
          <Fact label={t("Assurance")} value={t(LABEL[d.insuranceStatus] ?? d.insuranceStatus)} />
          {d.maintenanceId ? (
            <>
              <Divider />
              <Fact label={t("Ordre de réparation")} value={t("Ouvert")} />
            </>
          ) : null}
          {inc.report ? (
            <>
              <Divider />
              <Fact label={t("Résolution")} value={inc.report} />
            </>
          ) : null}
        </GlassCard>

        <SectionHeader title={t("Photos et pièces")} />
        <GlassCard>
          <View style={{ gap: spacing(3) }}>
            {view.attachments.length === 0 ? (
              <Text style={styles.small}>{t("Aucune pièce pour l'instant.")}</Text>
            ) : (
              <View style={styles.grid}>
                {view.attachments.map((a) => (
                  <SecureImage key={a.id} url={a.fileUrl} mimeType={a.mimeType} style={styles.thumb} />
                ))}
              </View>
            )}
            <InlineMessage text={actionError} />
            {!frozen ? <PhotoPickerRow busy={busy} onPicked={(f) => void attach(f)} onError={setActionError} /> : null}
          </View>
        </GlassCard>

        <SectionHeader title={t("Coûts")} />
        <GlassCard>
          <View style={styles.costGrid}>
            <Fact label={t("Estimé")} value={money(d.estimatedCost)} />
            <Fact label={t("Réel approuvé")} value={money(view.approvedCosts)} />
            <Fact label={t("Remboursé")} value={money(d.refundAmount)} />
            <Fact label={t("Coût net")} value={money(view.netCost)} />
          </View>
          {view.costs.length > 0 ? (
            <View style={{ marginTop: spacing(2) }}>
              {view.costs.map((c) => (
                <View key={c.id} style={styles.cost}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.costText}>{c.description ?? codeLabel(c.type)}</Text>
                    {c.rejectionReason ? <Text style={[styles.small, { color: colors.danger }]}>{c.rejectionReason}</Text> : null}
                  </View>
                  <Text style={styles.costAmount}>{money(c.amount)}</Text>
                  <Badge
                    label={codeLabel(c.status)}
                    tone={c.status === "APPROVED" ? "success" : c.status === "REJECTED" ? "danger" : "warning"}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        <SectionHeader title={t("Historique")} />
        <GlassCard>
          <View style={styles.timeline}>
            {view.timeline.map((e, i) => (
              <View key={`${e.at}-${i}`} style={styles.event}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, e.type === "INFO_REQUESTED" && { color: colors.warning }]}>{t(eventTitle(e))}</Text>
                  <Text style={styles.small}>
                    {formatDateTime(e.at)}
                    {e.actor ? ` · ${e.actor}` : ""}
                  </Text>
                  {e.note ? (
                    MESSAGE_EVENTS.includes(e.type) ? (
                      <Text style={[styles.bubble, e.byDriver ? styles.bubbleMine : null]}>{e.note}</Text>
                    ) : (
                      <Text style={styles.small}>{e.note}</Text>
                    )
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  title: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.text, marginTop: spacing(1) },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: spacing(2) },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing(2), marginTop: spacing(4) },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  step: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  fact: { paddingVertical: spacing(2.5), gap: 2, minWidth: "45%" },
  factLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  factValue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  thumb: { width: "31%", aspectRatio: 1, borderRadius: radius.sm },
  costGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing(4) },
  cost: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingVertical: spacing(2.5),
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  costText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  costAmount: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  timeline: { gap: spacing(4), borderLeftWidth: 1, borderLeftColor: colors.glassBorder, marginLeft: spacing(1), paddingLeft: spacing(4) },
  event: { flexDirection: "row", gap: spacing(2) },
  eventDot: {
    position: "absolute",
    left: -spacing(4) - 5,
    top: 5,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accentSoft,
  },
  eventTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  bubble: {
    marginTop: spacing(1),
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    overflow: "hidden",
  },
  bubbleMine: { backgroundColor: tint(colors.accentSoft, 0.2) },
}));
