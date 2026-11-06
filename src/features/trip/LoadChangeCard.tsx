import { Send } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { isQueued } from "@/api/client";
import { fetchTripSubmissions, submitTripComplement } from "@/api/driver";
import type { ApiTrip, MissionSubmission } from "@/api/types";
import { Badge, GlassCard, PillButton, Stepper, TextField } from "@/components/ui";
import { useT } from "@/i18n";
import { codeLabel } from "@/i18n/labels";
import { colors, fonts, spacing, themedStyles } from "@/theme/tokens";
import { ChoiceChips } from "../common/ChoiceChips";
import { InlineMessage } from "../common/InlineMessage";
import { errorMessage } from "../common/media";
import { isStopClosed } from "../driver/rules";

type Form = { changeType: "ADD" | "REMOVE"; detailId: string; stopId: string; itemType: string; description: string; quantity: number };
const EMPTY: Form = { changeType: "ADD", detailId: "", stopId: "", itemType: "CARGO", description: "", quantity: 0 };

/** Changement de chargement en route (ajout ou retrait / refus), soumis au gestionnaire. */
export function LoadChangeCard({
  trip,
  submissions,
  onSubmitted,
}: {
  trip: ApiTrip;
  submissions: MissionSubmission[];
  onSubmitted: (next: MissionSubmission[]) => void;
}) {
  const { t } = useT();
  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const details = (trip.details ?? []).filter((d) => d.id);
  const openStops = (trip.stops ?? []).filter((s) => !isStopClosed(s));

  async function send() {
    setMsg(null);
    if (form.changeType === "REMOVE" && !form.detailId) {
      setMsg({ ok: false, text: t("Choisissez la ligne du manifeste concernée.") });
      return;
    }
    setBusy(true);
    try {
      const line = details.find((d) => d.id === form.detailId);
      const result = await submitTripComplement(trip.id, {
        changeType: form.changeType,
        detailId: form.changeType === "REMOVE" ? form.detailId : undefined,
        stopId: form.changeType === "ADD" && form.stopId ? form.stopId : undefined,
        itemType: form.changeType === "REMOVE" ? (line?.itemType ?? "CARGO") : form.itemType,
        description: form.description.trim() || undefined,
        quantity: form.quantity > 0 ? form.quantity : undefined,
      });
      setForm(EMPTY);
      if (isQueued(result)) {
        // Hors ligne : la file l'enverra au retour du réseau, la liste se mettra alors à jour.
        setMsg({ ok: true, text: t("Signalement enregistré hors ligne : envoi automatique au retour du réseau.") });
        return;
      }
      setMsg({ ok: true, text: t("Signalement envoyé au gestionnaire.") });
      onSubmitted(await fetchTripSubmissions(trip.id));
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err, "Envoi impossible.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard>
      <Text style={styles.title}>{t("Changement de chargement")}</Text>
      <View style={styles.form}>
        <ChoiceChips
          value={form.changeType}
          options={[
            { value: "ADD", label: t("Chargement ajouté") },
            { value: "REMOVE", label: t("Chargement retiré / refusé") },
          ]}
          onChange={(changeType) => setForm({ ...form, changeType })}
        />
        {form.changeType === "REMOVE" ? (
          <ChoiceChips
            label={t("Ligne du manifeste…")}
            value={form.detailId}
            options={details.map((d) => ({
              value: d.id as string,
              label: `${codeLabel(d.itemType ?? "")} · ${d.description || "-"} (${d.quantity ?? 0})`,
            }))}
            onChange={(detailId) => setForm({ ...form, detailId })}
          />
        ) : (
          <>
            <ChoiceChips
              label={t("Arrêt")}
              value={form.stopId || "__next"}
              options={[
                { value: "__next", label: t("À livrer au prochain arrêt") },
                ...openStops.map((s) => ({ value: s.id, label: `${s.sequence}. ${s.location}` })),
              ]}
              onChange={(v) => setForm({ ...form, stopId: v === "__next" ? "" : v })}
            />
            <ChoiceChips
              label={t("Type")}
              value={form.itemType}
              options={["CARGO", "PASSENGER", "OTHER"].map((v) => ({ value: v, label: codeLabel(v) }))}
              onChange={(itemType) => setForm({ ...form, itemType })}
            />
          </>
        )}
        <TextField label={t("Description")} value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
        <View style={styles.qtyRow}>
          <Text style={styles.label}>{t("Quantité")}</Text>
          <Stepper value={form.quantity} min={0} onChange={(quantity) => setForm({ ...form, quantity })} />
        </View>
        <InlineMessage text={msg?.text} tone={msg?.ok ? "success" : "danger"} />
        <PillButton label={t("Signaler au gestionnaire")} icon={Send} variant="glass" loading={busy} disabled={busy} onPress={() => void send()} />
      </View>
      {submissions.length > 0 ? (
        <View style={styles.list}>
          {submissions.map((s) => (
            <View key={s.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemText} numberOfLines={2}>
                  {s.changeType === "REMOVE" ? "−" : "+"} {s.description || codeLabel(s.itemType)} {s.quantity ? `× ${s.quantity}` : ""}
                </Text>
                {s.status === "REJECTED" && s.rejectionReason ? (
                  <Text style={[styles.itemSub, { color: colors.danger }]}>
                    {t("Motif du refus")} : {s.rejectionReason}
                  </Text>
                ) : null}
                {s.status === "PENDING" ? <Text style={styles.itemSub}>{t("En attente de validation par le gestionnaire")}</Text> : null}
                {s.status === "APPROVED" ? <Text style={styles.itemSub}>{t("Validé : le manifeste est à jour.")}</Text> : null}
              </View>
              <Badge
                label={codeLabel(s.status)}
                tone={s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "danger" : "muted"}
              />
            </View>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = themedStyles(() => ({
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  form: { gap: spacing(4), marginTop: spacing(3) },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  list: { marginTop: spacing(4), gap: spacing(2), borderTopWidth: 1, borderTopColor: colors.glassBorder, paddingTop: spacing(3) },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing(2) },
  itemText: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  itemSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
}));
