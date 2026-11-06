import { router } from "expo-router";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Car,
  CheckCheck,
  ChevronRight,
  FileText,
  Fuel,
  Info,
  MessageCircle,
  Route,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { markAllNotificationsRead, markNotificationRead } from "@/api/driver";
import type { AppNotification } from "@/api/types";
import { AppHeader, ErrorState, GlassCard, IconButton, LoadingState, PillButton, Screen, SectionHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { humanizeCodesInText } from "@/i18n/labels";
import { InlineMessage } from "@/features/common/InlineMessage";
import { errorMessage } from "@/features/common/media";
import {
  isNotificationRead,
  useDriverActiveTrip,
  useDriverAssignments,
  useMyNotifications,
} from "@/features/driver/hooks";
import { needsAck } from "@/features/driver/rules";
import { notificationEvent, type ServerNotification } from "@/features/notifications/api";
import { notificationRoute } from "@/features/notifications/links";
import { signalNotificationsChanged } from "@/features/notifications/store";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

type Item = {
  id: string;
  icon: LucideIcon;
  color: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  linked?: boolean;
  onPress?: () => void;
};

function iconFor(n: ServerNotification): { icon: LucideIcon; color: string } {
  const v = notificationEvent(n) || (n.type ?? "").toUpperCase();
  if (v.startsWith("MESSAGE")) return { icon: MessageCircle, color: colors.accentSoft };
  if (v.startsWith("INCIDENT")) return { icon: AlertTriangle, color: colors.danger };
  if (v.startsWith("FUEL")) return { icon: Fuel, color: colors.accentSoft };
  if (v.startsWith("MAINTENANCE")) return { icon: Wrench, color: colors.warning };
  if (v.startsWith("EXPENSE")) return { icon: Wallet, color: v.endsWith("REJECTED") ? colors.danger : colors.success };
  if (v.includes("ASSIGN") || v.includes("SHIFT") || v.includes("SCHEDULE") || v.includes("ABSENCE")) return { icon: CalendarClock, color: colors.accentSoft };
  if (v.includes("DOC")) return { icon: FileText, color: colors.warning };
  if (v.includes("TRIP") || v.includes("STOP") || v.includes("SUBMISSION")) return { icon: Route, color: colors.success };
  if (v.startsWith("VEHICLE")) return { icon: Car, color: colors.accentSoft };
  return { icon: Info, color: colors.textSecondary };
}

/**
 * Notifications : rappels tirés des postes et du trajet en cours (comme DriverNotifications du
 * web) et notifications in-app du serveur, avec lu / non lu.
 */
export default function NotificationsScreen() {
  const { t } = useT();
  const notifications = useMyNotifications();
  const today = useDriverAssignments(true);
  const all = useDriverAssignments(false);
  const active = useDriverActiveTrip();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isRead = (n: AppNotification) => readIds.has(n.id) || isNotificationRead(n);
  const serverList = notifications.data?.content ?? [];

  // Rappels calculés, comme le web.
  const reminders: Item[] = [];
  const trip = active.data;
  if (trip) {
    reminders.push({
      id: `trip-${trip.id}`,
      icon: Route,
      color: colors.success,
      title: t("Trajet en cours"),
      body: `${trip.tripCode ?? ""} · ${trip.departureLocation ?? t("Départ enregistré")}`,
      time: `${trip.startDate} ${trip.startTime?.slice(0, 5) ?? ""}`,
      read: false,
      onPress: () => router.push("/trip/active"),
    });
  }
  const toAck = (all.data ?? []).filter(needsAck);
  if (toAck.length > 0) {
    reminders.push({
      id: "ack",
      icon: CalendarClock,
      color: colors.warning,
      title: t("Poste modifié"),
      body: `${toAck.length} ${t("poste(s) nouveau(x) ou modifié(s) à confirmer")}`,
      time: formatDateTime(toAck[0].changedAt ?? toAck[0].createdAt),
      read: false,
      onPress: () => router.push("/assignments"),
    });
  }
  for (const a of today.data ?? []) {
    reminders.push({
      id: `assignment-${a.id}`,
      icon: CalendarClock,
      color: colors.accentSoft,
      title: t("Poste planifié"),
      body: `${formatDateTime(a.startDatetime)} → ${formatDateTime(a.endDatetime)}`,
      time: formatDateTime(a.startDatetime),
      read: a.status === "COMPLETED",
      onPress: () => router.push("/assignments"),
    });
  }

  // Un appui marque la notification lue et ouvre l'écran concerné (incident, trajet, postes…).
  const items: Item[] = serverList.map((raw) => {
    const n = raw as ServerNotification;
    const { icon, color } = iconFor(n);
    const route = notificationRoute(n);
    const read = isRead(n);
    return {
      id: n.id,
      icon,
      color,
      title: humanizeCodesInText(n.title),
      body: humanizeCodesInText(n.message),
      time: formatDateTime(n.createdAt),
      read,
      linked: route != null,
      onPress: () => {
        if (!read) void markOne(n.id);
        if (route) router.push(route);
      },
    };
  });

  const unread = items.filter((n) => !n.read).length + reminders.filter((r) => !r.read).length;

  async function markOne(id: string) {
    setReadIds((s) => new Set(s).add(id));
    try {
      await markNotificationRead(id);
      signalNotificationsChanged();
    } catch (err) {
      setReadIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setError(errorMessage(err, "Action impossible."));
    }
  }

  async function markAll() {
    setError(null);
    try {
      await markAllNotificationsRead();
      setReadIds(new Set(serverList.map((n) => n.id)));
      signalNotificationsChanged();
    } catch (err) {
      setError(errorMessage(err, "Action impossible."));
    }
  }

  const hasServerUnread = items.some((n) => !n.read);

  return (
    <Screen
      header={
        <AppHeader
          title={t("Notifications")}
          subtitle={unread > 0 ? `${unread} ${t("non lue(s)")}` : t("Tout est à jour")}
          onBack={() => router.back()}
          right={hasServerUnread ? <IconButton icon={CheckCheck} accessibilityLabel={t("Tout marquer comme lu")} onPress={() => void markAll()} /> : undefined}
        />
      }
      refreshing={notifications.refreshing}
      onRefresh={() => {
        setReadIds(new Set());
        void notifications.refetch();
        void today.refetch();
        void all.refetch();
        void active.refetch();
      }}
    >
      <View style={styles.stack}>
        <InlineMessage text={error} />
        {reminders.length > 0 ? (
          <>
            <SectionHeader title={t("Aujourd'hui")} />
            {reminders.map((n) => (
              <NotificationCard key={n.id} item={n} />
            ))}
          </>
        ) : null}

        <SectionHeader title={t("Notifications")} />
        {hasServerUnread ? (
          <PillButton label={t("Tout marquer comme lu")} icon={CheckCheck} iconPosition="left" variant="glass" onPress={() => void markAll()} />
        ) : null}
        {notifications.loading && !notifications.data ? (
          <LoadingState />
        ) : notifications.error && !notifications.data ? (
          <ErrorState message={notifications.error} onRetry={() => void notifications.refetch()} />
        ) : items.length === 0 ? (
          <NotificationCard
            item={{
              id: "welcome",
              icon: Bell,
              color: colors.textSecondary,
              title: t("Bienvenue"),
              body: t("Vos notifications d'affectation et de trajet s'afficheront ici."),
              time: t("Maintenant"),
              read: true,
            }}
          />
        ) : (
          items.map((n) => <NotificationCard key={n.id} item={n} />)
        )}
      </View>
    </Screen>
  );
}

function NotificationCard({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <GlassCard
      onPress={item.onPress}
      style={!item.read ? { borderColor: tint(colors.accent, 0.5), backgroundColor: tint(colors.accent, 0.1) } : undefined}
    >
      <View style={styles.row}>
        <View style={[styles.tile, { backgroundColor: tint(item.color.startsWith("#") ? item.color : colors.accent, 0.16) }]}>
          <Icon size={20} color={item.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.read ? <View style={styles.dot} /> : null}
          </View>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        {item.linked ? <ChevronRight size={16} color={colors.textMuted} style={{ alignSelf: "center" }} /> : null}
      </View>
    </GlassCard>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(3) },
  row: { flexDirection: "row", gap: spacing(3) },
  tile: { width: 42, height: 42, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing(2) },
  title: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentSoft },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: spacing(1.5) },
}));
