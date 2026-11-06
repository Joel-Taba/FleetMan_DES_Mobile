import { router } from "expo-router";
import { CheckCircle2, Clock, Flag, Gauge, MapPin, Route, Timer, XCircle } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchTripSubmissions, stopAction, uploadFile, type PickedFile, type StopAction } from "@/api/driver";
import { isQueued } from "@/api/client";
import type { MissionSubmission, TripStop, TripStopStatus } from "@/api/types";
import {
  AppHeader,
  Badge,
  EmptyState,
  ErrorState,
  GlassCard,
  LicensePlate,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
  StatRow,
} from "@/components/ui";
import { useT } from "@/i18n";
import { formatNumber } from "@/i18n/format";
import { errorMessage, validatePicked } from "@/features/common/media";
import { useDriverActiveTrip, useDriverVehicle } from "@/features/driver/hooks";
import {
  expectedQty,
  hhmm,
  isStopClosed,
  localIsoNow,
  nextStop,
  tripDestination,
  tripStatusLabel,
  tripStatusTone,
} from "@/features/driver/rules";
import { CurrentStopCard, type Handled, type StopMode } from "@/features/trip/CurrentStopCard";
import { InterruptionCard } from "@/features/trip/InterruptionCard";
import { LoadChangeCard } from "@/features/trip/LoadChangeCard";
import { StopList } from "@/features/trip/StopList";
import { useLiveRefresh } from "@/features/trip/useLiveRefresh";
import { TrackingCard } from "@/features/tracking/TrackingCard";
import { colors, fonts, monoFont, radius, spacing, themedStyles } from "@/theme/tokens";

const STOP_RANK: Record<string, number> = { PENDING: 0, ARRIVED: 1, COMPLETED: 2, FAILED: 2, SKIPPED: 2 };

/**
 * Tournée côté chauffeur (DriverActiveTrip du web) : arrêt par arrêt (arrivée, livraison avec
 * quantités, réceptionnaire et preuve, échec motivé). Une fois tous les arrêts clos, le retour
 * à la base est enregistré au dépôt par le gestionnaire. En route, les changements de
 * chargement lui sont signalés.
 */
export default function ActiveTripScreen() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useDriverActiveTrip();
  const trip = data ?? null;
  const { data: vehicle } = useDriverVehicle(trip?.vehicleId);
  // Actions mises en file hors ligne : l'arrêt avance localement pour que la tournée continue ;
  // l'état du serveur reprend la main dès qu'il est au moins aussi avancé (file envoyée).
  const [offlineStatus, setOfflineStatus] = useState<Record<string, TripStopStatus>>({});
  const stops = useMemo(
    () =>
      (trip?.stops ?? []).map((s) => {
        const local = offlineStatus[s.id];
        if (!local || STOP_RANK[s.status] >= STOP_RANK[local]) return s;
        return { ...s, status: local, arrivedAt: s.arrivedAt ?? new Date().toISOString() };
      }),
    [trip, offlineStatus]
  );
  const current = nextStop(stops);
  const details = useMemo(() => (trip?.details ?? []).filter((d) => d.id), [trip]);
  const lines = current ? details.filter((d) => d.stopId === current.id) : [];

  const [mode, setMode] = useState<StopMode>(null);
  const [handled, setHandled] = useState<Handled>({});
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState("ABSENT");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [submissions, setSubmissions] = useState<MissionSubmission[]>([]);

  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId) return;
    fetchTripSubmissions(tripId).then(
      (list) => setSubmissions(list ?? []),
      () => setSubmissions([])
    );
  }, [tripId]);

  // Décisions du gestionnaire (départ, arrêt ajouté ou passé, changement validé ou refusé,
  // retour enregistré) visibles sans redémarrer l'app ; pas de relecture pendant une action.
  const { pulling, onPull } = useLiveRefresh(async () => {
    if (busy) return;
    await refetch();
    if (tripId) {
      await fetchTripSubmissions(tripId).then(
        (list) => setSubmissions(list ?? []),
        () => undefined
      );
    }
  }, trip ? 20_000 : 30_000);

  // Nouvel arrêt courant (servi, ou passé / ajouté par le gestionnaire) : formulaire remis à zéro.
  const [formStopId, setFormStopId] = useState(current?.id);
  if (formStopId !== current?.id) {
    setFormStopId(current?.id);
    setMode(null);
    setHandled({});
    setRecipient("");
    setNotes("");
    setProofUrl(null);
    setProofPreview(null);
    setMessage(null);
  }

  async function act(stop: TripStop, action: StopAction, body: Record<string, unknown>) {
    if (!trip) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await stopAction(trip.id, stop.id, action, body);
      if (isQueued(result)) {
        const next: TripStopStatus = action === "arrive" ? "ARRIVED" : action === "complete" ? "COMPLETED" : "FAILED";
        setOfflineStatus((m) => ({ ...m, [stop.id]: next }));
        setMessage({
          ok: true,
          text: t(action === "arrive"
            ? "Arrivée enregistrée hors ligne : envoi automatique au retour du réseau."
            : "Arrêt clôturé hors ligne : envoi automatique au retour du réseau."),
        });
      } else {
        await refetch();
      }
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, "Action impossible.") });
    } finally {
      setBusy(false);
    }
  }

  function deliver(stop: TripStop) {
    const payload = lines.map((line) => {
      const exp = expectedQty(line);
      const entry = handled[line.id as string];
      const qty = entry ? entry.qty : exp;
      return { detailId: line.id as string, quantity: qty, shortageReason: qty < exp ? entry?.reason || undefined : undefined };
    });
    if (payload.some((p, i) => p.quantity < expectedQty(lines[i]) && !p.shortageReason)) {
      setMessage({ ok: false, text: t("Indiquez le motif de l'écart (refus, avarie, manquant…).") });
      return;
    }
    if (stop.stopType === "DELIVERY" && !recipient.trim()) {
      setMessage({ ok: false, text: t("Le nom du réceptionnaire est obligatoire pour une livraison.") });
      return;
    }
    void act(stop, "complete", {
      arrivedAt: stop.arrivedAt ?? localIsoNow(),
      completedAt: localIsoNow(),
      recipientName: recipient.trim() || undefined,
      notes: notes.trim() || undefined,
      proofUrl: proofUrl ?? undefined,
      lines: payload,
    });
  }

  async function uploadProof(file: PickedFile) {
    const problem = validatePicked(file);
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }
    setProofBusy(true);
    setMessage(null);
    try {
      const uploaded = await uploadFile(file, "delivery-proof");
      setProofUrl(uploaded.fileUrl);
      setProofPreview(file.uri);
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, "Échec de l'upload photo.") });
    } finally {
      setProofBusy(false);
    }
  }

  const done = stops.filter(isStopClosed).length;
  const late = stops.filter((s) => s.punctuality === "LATE").length;
  const onTime = stops.filter((s) => s.punctuality && s.punctuality !== "LATE").length;
  const enRoute = trip?.status === "DEPARTED";

  // Action principale collée en bas de l'écran.
  let primary: { label: string; icon: typeof MapPin; variant?: "primary" | "danger"; onPress: () => void } | null = null;
  if (trip && enRoute && current) {
    if (mode === "deliver") primary = { label: busy ? t("Enregistrement…") : t("Valider l'arrêt"), icon: CheckCircle2, onPress: () => deliver(current) };
    else if (mode === "fail")
      primary = {
        label: t("Confirmer l'échec"),
        icon: XCircle,
        variant: "danger",
        onPress: () => void act(current, "fail", { reason: failure, notes: notes.trim() || undefined }),
      };
    else if (current.status === "PENDING")
      primary = { label: t("JE SUIS ARRIVÉ"), icon: MapPin, onPress: () => void act(current, "arrive", { arrivedAt: localIsoNow() }) };
    else if (current.status === "ARRIVED")
      primary = {
        label: t(current.stopType === "PICKUP" ? "Ramassage effectué" : "Livraison effectuée"),
        icon: CheckCircle2,
        onPress: () => setMode("deliver"),
      };
  }

  const header = <AppHeader title={t("Trajet en cours")} subtitle={trip?.tripCode ?? undefined} onBack={() => router.back()} />;

  if (!trip) {
    return (
      <Screen header={header} refreshing={pulling} onRefresh={() => void onPull()}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void refetch()} />
        ) : (
          <View style={{ gap: spacing(4), paddingTop: spacing(10) }}>
            <EmptyState icon={Route} title={t("Aucun trajet actif pour le moment.")} />
            <PillButton label={t("Voir mes postes")} variant="glass" onPress={() => router.push("/assignments")} />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: (primary ? 120 : spacing(8)) + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void onPull()} tintColor={colors.accentSoft} />}
      >
        {/* En-tête : destination, code, plaque, avancement. */}
        <GlassCard strong padding={20}>
          <View style={styles.heroHead}>
            <Badge label={tripStatusLabel(trip.status)} tone={tripStatusTone(trip.status)} />
            <Text style={styles.code}>{trip.tripCode}</Text>
          </View>
          <Text style={styles.mission}>{trip.missionObject || t("Tournée")}</Text>
          <Text style={styles.dest}>→ {tripDestination(trip) ?? t("Destination non précisée")}</Text>
          <View style={styles.plateRow}>
            {vehicle ? <LicensePlate plate={vehicle.licensePlate} /> : null}
            {vehicle ? (
              <Text style={styles.small}>
                {vehicle.brand} {vehicle.model}
              </Text>
            ) : null}
          </View>
          <View style={styles.bar}>
            {stops.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.barSeg,
                  s.status === "COMPLETED" && { backgroundColor: colors.success },
                  s.status === "FAILED" && { backgroundColor: colors.danger },
                  s.status === "SKIPPED" && { backgroundColor: colors.textMuted },
                  s.id === current?.id && { backgroundColor: colors.accentSoft },
                ]}
              />
            ))}
          </View>
          <Text style={styles.progress}>
            {done} / {stops.length} {t("arrêt(s) clos")}
          </Text>
        </GlassCard>

        <GlassCard>
          <StatRow
            items={[
              { icon: Flag, label: t("Arrêts"), value: `${done}/${stops.length}` },
              { icon: Clock, label: t("Départ"), value: hhmm(trip.startTime) },
              {
                icon: Gauge,
                label: t("Km départ"),
                value: trip.departureKmIndex != null ? formatNumber(trip.departureKmIndex) : "-",
              },
              { icon: Timer, label: t("Ponctualité"), value: onTime + late > 0 ? `${onTime}/${onTime + late}` : "-" },
            ]}
          />
        </GlassCard>

        {/* Partage de la position (premier plan) pendant que le trajet est en cours. */}
        <TrackingCard tripId={trip.id} tripStatus={trip.status} />

        <InterruptionCard trip={trip} />

        {enRoute && current ? (
          <>
            <CurrentStopCard
              stop={current}
              lines={lines}
              mode={mode}
              handled={handled}
              setHandled={setHandled}
              recipient={recipient}
              setRecipient={setRecipient}
              notes={notes}
              setNotes={setNotes}
              failure={failure}
              setFailure={setFailure}
              proofPreview={proofPreview}
              proofBusy={proofBusy}
              onProof={(file) => void uploadProof(file)}
              onClearProof={() => {
                setProofUrl(null);
                setProofPreview(null);
              }}
              message={message}
              onError={(text) => setMessage({ ok: false, text })}
            />
            {current.status === "ARRIVED" && mode === null ? (
              <PillButton label={t("Impossible de servir")} icon={XCircle} iconPosition="left" variant="glass" onPress={() => setMode("fail")} />
            ) : null}
            {mode !== null ? <PillButton label={t("Annuler")} variant="ghost" onPress={() => setMode(null)} /> : null}
          </>
        ) : (
          <GlassCard>
            <View style={styles.inline}>
              <Flag size={18} color={colors.accentSoft} />
              <Text style={styles.closedTitle}>
                {trip.status === "SCHEDULED" ? t("Le départ n'est pas encore enregistré.") : t("Tous les arrêts sont clos : retour à la base")}
              </Text>
            </View>
            <Text style={[styles.small, { marginTop: spacing(2) }]}>
              {t("Le retour (relevés kilométrage et carburant) est enregistré au dépôt par votre gestionnaire.")}
            </Text>
          </GlassCard>
        )}

        <SectionHeader title={t("Arrêts de la tournée")} />
        <StopList stops={stops} details={details} currentId={current?.id} />

        {enRoute ? <LoadChangeCard trip={trip} submissions={submissions} onSubmitted={setSubmissions} /> : null}
      </ScrollView>

      {primary ? (
        <View style={[styles.sticky, { paddingBottom: insets.bottom + spacing(3) }]}>
          <PillButton
            label={primary.label}
            icon={primary.icon}
            variant={primary.variant ?? "primary"}
            size="lg"
            loading={busy}
            disabled={busy || proofBusy}
            onPress={primary.onPress}
          />
          <Text style={styles.caption}>
            {t("Arrêt")} {current?.sequence} · {current?.location}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { paddingHorizontal: spacing(4), paddingTop: spacing(2), gap: spacing(4) },
  heroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontFamily: monoFont, fontSize: 13, color: colors.textSecondary },
  mission: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing(4) },
  dest: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.text, marginTop: spacing(1) },
  plateRow: { flexDirection: "row", alignItems: "center", gap: spacing(3), marginTop: spacing(3), flexWrap: "wrap" },
  bar: { flexDirection: "row", gap: 3, height: 6, borderRadius: radius.pill, overflow: "hidden", marginTop: spacing(4) },
  barSeg: { flex: 1, backgroundColor: colors.trackStrong },
  progress: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text, marginTop: spacing(2) },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  closedTitle: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    backgroundColor: colors.stickyGlass,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    gap: spacing(1.5),
  },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: "center" },
}));
