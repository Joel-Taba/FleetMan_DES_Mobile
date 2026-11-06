import { router } from "expo-router";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarOff,
  FileText,
  Megaphone,
  MessageCircle,
  Navigation,
  Route,
  Truck,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  Avatar,
  EmptyState,
  ErrorState,
  GlassCard,
  IconButton,
  IconChip,
  LicensePlate,
  LoadingState,
  PillButton,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { useT } from "@/i18n";
import { formatDate, formatTime } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { AssignmentCard } from "@/features/driver/AssignmentCard";
import {
  isNotificationRead,
  useDriverActiveTrip,
  useDriverAssignments,
  useDriverProfile,
  useDriverTripHistory,
  useDriverVehicle,
  useMyNotifications,
} from "@/features/driver/hooks";
import { needsAck, nextStop, stopProgress, tripDestination } from "@/features/driver/rules";
import { TripMiniCard } from "@/features/driver/TripCard";
import { useUnreadMessageCount } from "@/features/messages/hooks";
import { pastTrips, upcomingTrips } from "@/features/trip/tripLists";
import { useLiveRefresh } from "@/features/trip/useLiveRefresh";
import { colors, fonts, monoFont, radius, spacing, tint, themedStyles } from "@/theme/tokens";

/** Accueil chauffeur (DriverDashboard du web) : trajet en cours ou prochain poste, raccourcis, postes du jour, derniers trajets. */
export default function HomeScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const profile = useDriverProfile();
  const active = useDriverActiveTrip();
  const today = useDriverAssignments(true);
  const all = useDriverAssignments(false);
  const history = useDriverTripHistory();
  const notifications = useMyNotifications();
  const vehicle = useDriverVehicle(profile.data?.assignedVehicleId);
  const messagesUnread = useUnreadMessageCount();

  const trip = active.data ?? null;
  const todayList = today.data ?? [];
  const toAck = (all.data ?? []).filter(needsAck).length;
  const unreadMessages = messagesUnread.data?.unread ?? 0;
  const unread = (notifications.data?.content ?? []).filter((n) => !isNotificationRead(n)).length;
  const [now] = useState(() => Date.now());
  const upcoming = useMemo(() => {
    return (all.data ?? [])
      .filter((a) => a.status !== "CANCELLED" && a.status !== "COMPLETED" && new Date(a.endDatetime).getTime() >= now)
      .sort((a, b) => a.startDatetime.localeCompare(b.startDatetime))[0];
  }, [all.data, now]);
  const nextTrip = trip ? undefined : upcomingTrips(history.data ?? [])[0];
  const nextVehicle = useDriverVehicle(nextTrip?.vehicleId);
  const recent = pastTrips(history.data ?? [], trip?.id).slice(0, 8);
  const firstName = profile.data?.firstName ?? user?.firstName ?? "";
  const absence = profile.data?.currentAbsence ?? profile.data?.nextAbsence ?? null;

  function refresh() {
    return Promise.all([
      profile.refetch(),
      active.refetch(),
      today.refetch(),
      all.refetch(),
      history.refetch(),
      notifications.refetch(),
      messagesUnread.refetch(),
    ]);
  }
  // Trajet assigné, départ enregistré, retour validé : l'accueil suit sans redémarrer l'app.
  const { pulling, onPull } = useLiveRefresh(refresh, trip ? 30_000 : 60_000);

  const progress = trip ? stopProgress(trip) : { done: 0, total: 0 };
  const current = trip ? nextStop(trip.stops ?? []) : null;

  return (
    <Screen withTabBar refreshing={pulling} onRefresh={() => void onPull()}>
      <View style={styles.stack}>
        <View style={styles.topRow}>
          <Avatar name={`${firstName} ${profile.data?.lastName ?? user?.lastName ?? ""}`.trim() || "?"} photoUrl={profile.data?.photoUrl ?? user?.photoUrl} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>
              {t("Bonjour")} {firstName}
            </Text>
            <Text style={styles.date}>{formatDate(new Date())} · {t("Prêt pour votre journée ?")}</Text>
          </View>
          <IconButton
            icon={Bell}
            badge={unread + toAck > 0 ? unread + toAck : undefined}
            accessibilityLabel={t("Notifications")}
            onPress={() => router.push("/notifications")}
          />
        </View>

        {profile.loading && !profile.data ? (
          <LoadingState />
        ) : profile.error && !profile.data ? (
          <ErrorState message={profile.error} onRetry={() => void refresh()} />
        ) : null}

        {/* Carte principale : trajet en cours, sinon prochain poste, sinon véhicule. */}
        {trip ? (
          <GlassCard strong padding={20}>
            <View style={styles.heroHead}>
              <Text style={styles.eyebrow}>{t("Trajet en cours")}</Text>
              <Text style={styles.code}>{trip.tripCode}</Text>
            </View>
            <View style={styles.route}>
              <View style={styles.routeDots}>
                <View style={[styles.dot, { backgroundColor: colors.accentSoft }]} />
                <View style={styles.routeLine} />
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
              </View>
              <View style={{ flex: 1, gap: spacing(3) }}>
                <Text style={styles.routeText} numberOfLines={1}>
                  {trip.departureLocation ?? t("Départ enregistré")}
                </Text>
                <Text style={[styles.routeText, styles.routeDest]} numberOfLines={2}>
                  {tripDestination(trip) ?? t("Destination non précisée")}
                </Text>
              </View>
            </View>
            {progress.total > 0 ? (
              <View style={{ marginTop: spacing(4), gap: spacing(2) }}>
                <View style={styles.bar}>
                  {(trip.stops ?? []).map((s) => (
                    <View
                      key={s.id}
                      style={[
                        styles.barSeg,
                        s.status === "COMPLETED" && { backgroundColor: colors.success },
                        s.status === "FAILED" && { backgroundColor: colors.danger },
                        s.status === "SKIPPED" && { backgroundColor: colors.textMuted },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.small}>
                  {progress.done} / {progress.total} {t("arrêt(s) clos")}
                  {current ? ` · ${t("Prochain arrêt")} : ${current.location}` : ""}
                </Text>
              </View>
            ) : null}
            <PillButton
              label={t("Reprendre le trajet")}
              icon={ArrowRight}
              size="lg"
              style={{ marginTop: spacing(5) }}
              onPress={() => router.push("/trip/active")}
            />
          </GlassCard>
        ) : nextTrip ? (
          <GlassCard strong padding={20}>
            <View style={styles.heroHead}>
              <Text style={styles.eyebrow}>{t("Prochain trajet")}</Text>
              <Text style={styles.code}>{nextTrip.tripCode}</Text>
            </View>
            <Text style={styles.heroTitle}>
              {formatTime(`${nextTrip.startDate}T${nextTrip.startTime ?? "00:00"}`)}
            </Text>
            <Text style={styles.small}>
              {formatDate(nextTrip.startDate)} · {(nextTrip.stops ?? []).length} {t("arrêt(s)")}
              {nextTrip.scheduledReturnDatetime ? ` · ${t("Retour prévu")} ${formatTime(nextTrip.scheduledReturnDatetime)}` : ""}
            </Text>
            <View style={styles.route}>
              <View style={styles.routeDots}>
                <View style={[styles.dot, { backgroundColor: colors.accentSoft }]} />
                <View style={styles.routeLine} />
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
              </View>
              <View style={{ flex: 1, gap: spacing(3) }}>
                <Text style={styles.routeText} numberOfLines={1}>
                  {nextTrip.departureLocation ?? t("Départ")}
                </Text>
                <Text style={[styles.routeText, styles.routeDest]} numberOfLines={2}>
                  {tripDestination(nextTrip) ?? t("Destination non précisée")}
                </Text>
              </View>
            </View>
            {nextTrip.missionObject ? <Text style={[styles.small, { marginTop: spacing(3) }]}>{nextTrip.missionObject}</Text> : null}
            {nextVehicle.data ? (
              <View style={styles.vehicleRow}>
                <LicensePlate plate={nextVehicle.data.licensePlate} />
                <Text style={styles.small}>
                  {nextVehicle.data.brand} {nextVehicle.data.model}
                </Text>
              </View>
            ) : null}
            <PillButton
              label={t("Voir le trajet")}
              icon={ArrowRight}
              size="lg"
              style={{ marginTop: spacing(5) }}
              onPress={() => router.push({ pathname: "/trip/[id]", params: { id: nextTrip.id } })}
            />
            <Text style={[styles.small, { marginTop: spacing(2), textAlign: "center" }]}>
              {t("Le départ est enregistré par votre gestionnaire.")}
            </Text>
          </GlassCard>
        ) : upcoming ? (
          <GlassCard strong padding={20}>
            <Text style={styles.eyebrow}>{t("Prochain poste")}</Text>
            <Text style={styles.heroTitle}>
              {formatTime(upcoming.startDatetime)} → {formatTime(upcoming.endDatetime)}
            </Text>
            <Text style={styles.small}>
              {formatDate(upcoming.startDatetime)} · {codeLabel(upcoming.status, "assignmentStatus")}
            </Text>
            {vehicle.data ? (
              <View style={styles.vehicleRow}>
                <LicensePlate plate={vehicle.data.licensePlate} />
                <Text style={styles.small}>
                  {vehicle.data.brand} {vehicle.data.model}
                </Text>
              </View>
            ) : null}
            <PillButton
              label={t("Voir mes postes")}
              icon={ArrowRight}
              size="lg"
              style={{ marginTop: spacing(5) }}
              onPress={() => router.push("/assignments")}
            />
          </GlassCard>
        ) : !profile.loading ? (
          <GlassCard strong padding={20}>
            <Text style={styles.eyebrow}>{t("Mon véhicule")}</Text>
            {vehicle.data ? (
              <View style={styles.vehicleRow}>
                <LicensePlate plate={vehicle.data.licensePlate} size="md" />
                <Text style={styles.small}>
                  {vehicle.data.brand} {vehicle.data.model}
                </Text>
              </View>
            ) : (
              <Text style={[styles.small, { marginTop: spacing(2) }]}>{t("Aucun véhicule assigné. Contactez votre gestionnaire.")}</Text>
            )}
            <Text style={[styles.small, { marginTop: spacing(3) }]}>{t("Aucun trajet actif pour le moment.")}</Text>
          </GlassCard>
        ) : null}

        {absence ? (
          <GlassCard style={{ borderColor: tint(colors.warning, 0.5) }}>
            <View style={styles.inline}>
              <CalendarOff size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.absenceTitle}>
                  {codeLabel(absence.type)}
                  {profile.data?.currentAbsence ? ` · ${t("En cours")}` : ""}
                </Text>
                <Text style={styles.small}>
                  {absence.endDate
                    ? `${t("Du")} ${formatDate(absence.startDate)} ${t("au")} ${formatDate(absence.endDate)}`
                    : `${t("Depuis le")} ${formatDate(absence.startDate)} (${t("sans date de fin")})`}
                </Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <IconChip icon={Navigation} label={t("Trajet actif")} active={Boolean(trip)} onPress={() => router.push("/trip/active")} />
          <IconChip icon={CalendarClock} label={t("Mes postes")} active={toAck > 0} onPress={() => router.push("/assignments")} />
          <IconChip
            icon={MessageCircle}
            label={unreadMessages > 0 ? `${t("Messages")} (${unreadMessages})` : t("Messages")}
            active={unreadMessages > 0}
            onPress={() => router.push("/messages")}
          />
          <IconChip icon={Megaphone} label={t("Déclarer")} onPress={() => router.push("/declare")} />
          <IconChip icon={FileText} label={t("Documents")} onPress={() => router.push("/documents")} />
          <IconChip icon={Bell} label={t("Notifications")} active={unread > 0} onPress={() => router.push("/notifications")} />
        </ScrollView>

        <SectionHeader title={t("Aujourd'hui")} actionLabel={t("Tout voir")} onAction={() => router.push("/assignments")} />
        {today.loading && !today.data ? (
          <LoadingState />
        ) : todayList.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t("Aucune affectation aujourd'hui.")} />
        ) : (
          <View style={{ gap: spacing(3) }}>
            {todayList.slice(0, 3).map((a) => (
              <AssignmentCard key={a.id} assignment={a} compact />
            ))}
          </View>
        )}

        <SectionHeader title={t("Derniers trajets")} actionLabel={t("Tout voir")} onAction={() => router.push("/trips")} />
        {history.loading && !history.data ? (
          <LoadingState />
        ) : recent.length === 0 ? (
          <EmptyState icon={Route} title={t("Aucun trajet terminé pour l'instant.")} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(3), paddingRight: spacing(4) }}>
            {recent.map((trip) => (
              <TripMiniCard key={trip.id} trip={trip} />
            ))}
          </ScrollView>
        )}

        {vehicle.data && trip ? (
          <GlassCard onPress={() => router.push("/vehicle")}>
            <View style={styles.inline}>
              <Truck size={20} color={colors.accentSoft} />
              <LicensePlate plate={vehicle.data.licensePlate} size="sm" />
              <Text style={[styles.small, { flex: 1 }]} numberOfLines={1}>
                {vehicle.data.brand} {vehicle.data.model}
              </Text>
            </View>
          </GlassCard>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing(3), marginTop: spacing(1) },
  hello: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.text },
  date: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  heroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.accentSoft },
  code: { fontFamily: monoFont, fontSize: 13, color: colors.textSecondary },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.text, marginTop: spacing(2) },
  route: { flexDirection: "row", gap: spacing(3), marginTop: spacing(4) },
  routeDots: { alignItems: "center", paddingVertical: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { flex: 1, width: 2, backgroundColor: colors.glassBorder, marginVertical: 3, minHeight: 18 },
  routeText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
  routeDest: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  bar: { flexDirection: "row", gap: 3, height: 6, borderRadius: radius.pill, overflow: "hidden" },
  barSeg: { flex: 1, backgroundColor: colors.trackStrong },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: spacing(3), marginTop: spacing(3), flexWrap: "wrap" },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  absenceTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.warning },
  chips: { gap: spacing(3), paddingRight: spacing(4) },
}));
