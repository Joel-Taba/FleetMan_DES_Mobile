import { router, useFocusEffect } from "expo-router";
import { FileCheck2, FileClock, FileDown, FileText, Printer, RefreshCw, ShieldAlert, ShieldCheck, Upload } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { archiveDocument, fetchDocumentChecklist, fetchDocumentHistory, fetchTargetDocuments, type DocumentTargetKind } from "@/api/driver";
import type { DocumentChecklistItem, DocumentResponse } from "@/api/types";
import { Badge, GlassCard, LoadingState, PillButton, SectionHeader } from "@/components/ui";
import type { Page } from "@/api/client";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useT } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";
import { InlineMessage } from "../common/InlineMessage";
import { SecureImage } from "../common/SecureImage";
import { errorMessage } from "../common/media";
import { DOC_TYPE_LABELS, STATE_LABEL, STATE_TONE, docStatusTone } from "./docTypes";
import { exportDocumentPdf, exportVehicleSheetPdf, openDocumentFile, type ExportVehicle } from "./exportPdf";

/**
 * Dossier documentaire (DocumentDossier du web, côté chauffeur) : checklist des pièces avec
 * état et expiration, dépôts en attente, pièces en vigueur, historique des versions.
 * `canSubmit` : dépôt et renouvellement (dossier du chauffeur uniquement).
 * `vehicle` : plaque et modèle (dossier véhicule), repris sur les PDF exportés.
 */
export function DocumentDossier({
  kind,
  targetId,
  title,
  canSubmit = false,
  caption,
  vehicle,
  ownerName,
}: {
  kind: DocumentTargetKind;
  targetId: string;
  title: string;
  canSubmit?: boolean;
  /** Ligne d'explication sous le titre (ex. « Véhicule attitré »). */
  caption?: string;
  vehicle?: ExportVehicle;
  ownerName?: string | null;
}) {
  const { t } = useT();
  const checklist = useApiQuery<DocumentChecklistItem[]>(`docs:checklist:${kind}:${targetId}`, () => fetchDocumentChecklist(kind, targetId), [kind, targetId]);
  const docs = useApiQuery<Page<DocumentResponse>>(`docs:list:${kind}:${targetId}`, () => fetchTargetDocuments(kind, targetId), [kind, targetId]);
  const [history, setHistory] = useState<DocumentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Pièce en cours d'export ou d'ouverture (`all` : fiche complète du véhicule). */
  const [exporting, setExporting] = useState<string | null>(null);
  const label = (type: string) => t(DOC_TYPE_LABELS[type] ?? type);

  const items = checklist.data ?? [];
  const list = docs.data?.content ?? [];
  const waiting = list.filter((d) => d.reviewStatus === "PENDING" || d.reviewStatus === "REJECTED");
  const inForce = list.filter((d) => d.current);
  const blocking = items.filter((i) => i.mandatory && ["MISSING", "EXPIRED", "PENDING", "REJECTED"].includes(i.state));

  function refresh() {
    void checklist.refetch();
    void docs.refetch();
  }

  // Retour du formulaire de dépôt : le dossier est relu (pas au premier affichage).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refresh();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function upload(docType?: string) {
    router.push({ pathname: "/document-upload", params: { targetId, ...(docType ? { docType } : {}) } });
  }

  async function withdraw(d: DocumentResponse) {
    setBusy(true);
    setError(null);
    try {
      await archiveDocument(d.id, t("Dépôt retiré"));
      refresh();
    } catch (err) {
      setError(errorMessage(err, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function runFileAction(key: string, action: () => Promise<void>) {
    if (exporting) return;
    setExporting(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, "Export impossible."));
    } finally {
      setExporting(null);
    }
  }

  const exportContext = { vehiclePlate: vehicle?.licensePlate, vehicleLabel: vehicle?.label, ownerName };
  const openDoc = (d: DocumentResponse) => void runFileAction(`open:${d.id}`, () => openDocumentFile(d));
  const exportDoc = (d: DocumentResponse) => void runFileAction(`pdf:${d.id}`, () => exportDocumentPdf(d, exportContext));
  const exportAll = () => vehicle && void runFileAction("all", () => exportVehicleSheetPdf(vehicle, inForce));

  async function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }
    setError(null);
    try {
      setHistory(await fetchDocumentHistory(kind, targetId));
    } catch (err) {
      setError(errorMessage(err, "Action impossible."));
    }
  }

  return (
    <View style={styles.stack}>
      <SectionHeader title={title} actionLabel={history ? t("Fermer") : t("Historique")} onAction={() => void toggleHistory()} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {vehicle && inForce.length > 0 ? (
        <PillButton
          label={exporting === "all" ? t("Préparation du PDF…") : t("Tout exporter en PDF")}
          icon={Printer}
          iconPosition="left"
          variant="glass"
          disabled={exporting !== null}
          onPress={exportAll}
        />
      ) : null}

      <GlassCard style={blocking.length > 0 ? { borderColor: tint(colors.danger, 0.5) } : undefined}>
        <View style={styles.summary}>
          {blocking.length > 0 ? <ShieldAlert size={22} color={colors.danger} /> : <ShieldCheck size={22} color={colors.success} />}
          <Text style={[styles.summaryText, { color: blocking.length > 0 ? colors.danger : colors.text }]}>
            {blocking.length > 0 ? t("Dossier incomplet : aucun nouveau trajet ni poste possible.") : t("Pièces obligatoires en règle.")}
          </Text>
        </View>
        {items.length > 0 ? (
          <View style={styles.totals}>
            <Text style={styles.totalItem}>
              {t("En règle")} <Text style={styles.totalValue}>{items.filter((i) => i.state === "OK").length}</Text>
            </Text>
            <Text style={styles.totalItem}>
              {t("Expire bientôt")} <Text style={styles.totalValue}>{items.filter((i) => i.state === "EXPIRING").length}</Text>
            </Text>
            <Text style={styles.totalItem}>
              {t("Manquante")} <Text style={styles.totalValue}>{items.filter((i) => i.state === "MISSING").length}</Text>
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <InlineMessage text={error} />

      {checklist.loading && !checklist.data ? (
        <LoadingState />
      ) : (
        <GlassCard padding={4}>
          {items.map((item, i) => (
            <View key={item.docType} style={[styles.item, i > 0 && styles.itemBorder]}>
              <View style={[styles.tile, { backgroundColor: tint(item.state === "OK" ? colors.success : item.state === "MISSING" ? colors.accent : colors.warning, 0.15) }]}>
                <FileText size={20} color={item.state === "OK" ? colors.success : colors.accentSoft} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle}>{label(item.docType)}</Text>
                <Text style={styles.itemSub}>
                  {item.legal ? t("Légale") : item.mandatory ? t("Entreprise") : t("Facultative")}
                  {item.expiryDate ? ` · ${t("Expiration")} ${formatDate(item.expiryDate)}` : ""}
                </Text>
                {item.renewalPending ? <Text style={styles.itemHint}>{t("Renouvellement à contrôler")}</Text> : null}
                {item.requestedAt ? (
                  <Text style={styles.itemHint}>
                    {t("Demandée par votre gestionnaire le")} {formatDate(item.requestedAt)}
                    {item.requestMessage ? ` : ${item.requestMessage}` : ""}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: spacing(1.5) }}>
                <Badge label={t(STATE_LABEL[item.state] ?? item.state)} tone={STATE_TONE[item.state] ?? "muted"} />
                {canSubmit && item.state !== "PENDING" && !item.renewalPending ? (
                  <Pressable onPress={() => upload(item.docType)} style={styles.action} accessibilityRole="button">
                    {item.state === "MISSING" || item.state === "REJECTED" ? (
                      <Upload size={14} color={colors.accentSoft} />
                    ) : (
                      <RefreshCw size={14} color={colors.accentSoft} />
                    )}
                    <Text style={styles.actionText}>{item.state === "MISSING" || item.state === "REJECTED" ? t("Déposer") : t("Renouveler")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </GlassCard>
      )}

      {canSubmit ? <PillButton label={t("Ajouter un document")} icon={Upload} iconPosition="left" variant="glass" onPress={() => upload()} /> : null}

      {waiting.length > 0 ? (
        <>
          <Text style={styles.subTitle}>{t("Dépôts à traiter")}</Text>
          {waiting.map((d) => (
            <GlassCard key={d.id}>
              <View style={styles.docRow}>
                <SecureImage url={d.fileUrl} mimeType={d.fileMimeType} style={styles.preview} onPress={() => openDoc(d)} />
                <View style={{ flex: 1, gap: spacing(1) }}>
                  <Text style={styles.itemTitle}>{label(d.docType)}</Text>
                  {d.docNumber ? <Text style={styles.itemSub}>{d.docNumber}</Text> : null}
                  <View style={{ flexDirection: "row" }}>
                    <Badge label={codeLabel(d.status)} tone={docStatusTone(d.status)} />
                  </View>
                  {d.licenseCategories ? (
                    <Text style={styles.itemSub}>
                      {t("Catégories")} : {d.licenseCategories}
                    </Text>
                  ) : null}
                  {d.rejectionReason ? (
                    <Text style={[styles.itemSub, { color: colors.danger }]}>
                      {t("Motif du rejet")} : {d.rejectionReason}
                    </Text>
                  ) : null}
                </View>
              </View>
              {canSubmit && d.reviewStatus === "PENDING" ? (
                <PillButton label={t("Retirer")} variant="ghost" disabled={busy} onPress={() => void withdraw(d)} style={{ marginTop: spacing(2) }} />
              ) : null}
            </GlassCard>
          ))}
        </>
      ) : null}

      {inForce.length > 0 ? (
        <>
          <Text style={styles.subTitle}>{t("Pièces en vigueur")}</Text>
          {inForce.map((d) => (
            <GlassCard key={d.id}>
              <View style={styles.docRow}>
                <SecureImage url={d.fileUrl} mimeType={d.fileMimeType} style={styles.preview} onPress={() => openDoc(d)} />
                <View style={{ flex: 1, gap: spacing(1) }}>
                  <Text style={styles.itemTitle}>{label(d.docType)}</Text>
                  {d.docNumber ? <Text style={styles.itemSub}>{d.docNumber}</Text> : null}
                  <Text style={styles.itemSub}>
                    {t("Expiration")} : {d.expiryDate ? formatDate(d.expiryDate) : "-"}
                    {d.daysUntilExpiry != null && d.expiryDate ? ` (${d.daysUntilExpiry} ${t("j")})` : ""}
                  </Text>
                  <View style={{ flexDirection: "row" }}>
                    <Badge label={codeLabel(d.status)} tone={docStatusTone(d.status)} />
                  </View>
                </View>
              </View>
              <View style={styles.docActions}>
                <Pressable onPress={() => openDoc(d)} disabled={exporting !== null} style={styles.action} accessibilityRole="button">
                  {exporting === `open:${d.id}` ? <ActivityIndicator size="small" color={colors.accentSoft} /> : <FileText size={14} color={colors.accentSoft} />}
                  <Text style={styles.actionText}>{t("Ouvrir")}</Text>
                </Pressable>
                <Pressable onPress={() => exportDoc(d)} disabled={exporting !== null} style={styles.action} accessibilityRole="button">
                  {exporting === `pdf:${d.id}` ? <ActivityIndicator size="small" color={colors.accentSoft} /> : <FileDown size={14} color={colors.accentSoft} />}
                  <Text style={styles.actionText}>{t("Exporter en PDF")}</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </>
      ) : null}

      {history ? (
        <GlassCard padding={4}>
          <View style={styles.historyHead}>
            <FileClock size={18} color={colors.accentSoft} />
            <Text style={styles.itemTitle}>{t("Historique du dossier")}</Text>
          </View>
          {history.length === 0 ? (
            <Text style={[styles.itemSub, { padding: spacing(3) }]}>{t("Aucun document.")}</Text>
          ) : (
            history.map((d) => (
              <Pressable key={d.id} onPress={() => openDoc(d)} style={[styles.item, styles.itemBorder]}>
                <FileCheck2 size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {label(d.docType)} · v{d.version ?? 1}
                  </Text>
                  <Text style={styles.itemSub}>{formatDate(d.createdAt)}</Text>
                  {d.rejectionReason ? <Text style={[styles.itemSub, { color: colors.danger }]}>{d.rejectionReason}</Text> : null}
                  {d.archiveReason ? <Text style={styles.itemSub}>{d.archiveReason}</Text> : null}
                </View>
                <Badge label={codeLabel(d.status)} tone={docStatusTone(d.status)} />
              </Pressable>
            ))
          )}
        </GlassCard>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(3) },
  summary: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  summaryText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
  totals: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing(3),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  totalItem: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.text },
  item: { flexDirection: "row", alignItems: "center", gap: spacing(3), padding: spacing(3) },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.glassBorder },
  tile: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  itemSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  itemHint: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.warning, marginTop: 2 },
  action: { flexDirection: "row", alignItems: "center", gap: spacing(1), paddingVertical: 2 },
  actionText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accentSoft },
  subTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary, marginTop: spacing(1) },
  docRow: { flexDirection: "row", gap: spacing(3) },
  docActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing(4),
    marginTop: spacing(3),
    paddingTop: spacing(2),
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, marginTop: -spacing(2) },
  preview: { width: 72, height: 72, borderRadius: radius.sm },
  historyHead: { flexDirection: "row", alignItems: "center", gap: spacing(2), padding: spacing(3) },
}));
