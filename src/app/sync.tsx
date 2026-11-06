import { router } from "expo-router";
import { CloudOff, CloudUpload } from "lucide-react-native";
import { Text, View } from "react-native";

import { AppHeader, Badge, EmptyState, GlassCard, PillButton, Screen, SectionHeader } from "@/components/ui";
import { confirmAction } from "@/components/profile/confirm";
import { useOnline } from "@/hooks/useOnline";
import { useT } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { describeItem, OFFLINE_KIND_LABEL, useOfflineQueue } from "@/features/offline/hooks";
import { withCount } from "@/features/offline/OfflineBanner";
import type { QueueItem } from "@/features/offline/rules";
import { discardItem, flushQueue, retryItem } from "@/features/offline/sync";
import { colors, fonts, spacing, tint, themedStyles } from "@/theme/tokens";

/** Actions saved offline: pending ones (sent automatically) and the ones refused by the server. */
export default function SyncScreen() {
  const { t } = useT();
  const online = useOnline();
  const { pending, failed, syncing, inFlightId } = useOfflineQueue();

  async function discard(item: QueueItem) {
    const ok = await confirmAction(
      t("Supprimer cette action ?"),
      t("Elle ne sera jamais envoyée à votre gestionnaire."),
      t("Supprimer"),
      t("Annuler")
    );
    if (ok) discardItem(item.id);
  }

  function renderItem(item: QueueItem, refused: boolean) {
    const detail = describeItem(item);
    const busy = inFlightId === item.id;
    return (
      <GlassCard key={item.id} style={refused ? { borderColor: tint(colors.danger, 0.4) } : undefined}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>
            {t(OFFLINE_KIND_LABEL[item.kind])}
          </Text>
          <Badge
            label={busy ? t("Envoi…") : refused ? t("Refusée") : t("En attente")}
            tone={busy ? "default" : refused ? "danger" : "warning"}
          />
        </View>
        {detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {t("Créée le")} {formatDateTime(new Date(item.createdAt).toISOString())}
          {item.attempts > 0 ? ` · ${withCount(t("{n} essai(s)"), item.attempts)}` : ""}
        </Text>
        {item.lastError ? (
          <Text style={[styles.error, { color: refused ? colors.danger : colors.textSecondary }]}>
            {refused ? `${t("Motif du refus")} : ` : `${t("Dernière erreur")} : `}
            {item.lastError}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <View style={styles.flex}>
            <PillButton
              label={t("Réessayer")}
              variant="glass"
              disabled={busy}
              onPress={() => void retryItem(item.id)}
            />
          </View>
          <View style={styles.flex}>
            <PillButton
              label={t("Supprimer")}
              variant="danger"
              disabled={busy}
              onPress={() => void discard(item)}
            />
          </View>
        </View>
      </GlassCard>
    );
  }

  return (
    <Screen header={<AppHeader title={t("Actions hors ligne")} onBack={() => router.back()} />}>
      <View style={styles.stack}>
        {pending.length === 0 && failed.length === 0 ? (
          <EmptyState
            icon={CloudUpload}
            title={t("Aucune action en attente.")}
            message={t("Les actions faites sans réseau apparaissent ici jusqu'à leur envoi.")}
          />
        ) : null}

        {pending.length > 0 ? (
          <>
            <SectionHeader title={withCount(t("En attente d'envoi ({n})"), pending.length)} />
            <GlassCard>
              <View style={styles.head}>
                {online ? <CloudUpload size={18} color={colors.accentSoft} /> : <CloudOff size={18} color={colors.warning} />}
                <Text style={styles.info}>
                  {online
                    ? t("Envoi automatique dans l'ordre de saisie.")
                    : t("Hors ligne : envoi automatique au retour du réseau.")}
                </Text>
              </View>
              <PillButton
                label={syncing ? t("Synchronisation…") : t("Tout envoyer maintenant")}
                loading={syncing}
                disabled={syncing}
                style={{ marginTop: spacing(3) }}
                onPress={() => void flushQueue(true)}
              />
            </GlassCard>
            {pending.map((item) => renderItem(item, false))}
          </>
        ) : null}

        {failed.length > 0 ? (
          <>
            <SectionHeader title={withCount(t("Refusées par le serveur ({n})"), failed.length)} />
            <Text style={styles.caption}>
              {t("Corrigez si besoin puis réessayez, ou supprimez l'action.")}
            </Text>
            {failed.map((item) => renderItem(item, true))}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  stack: { gap: spacing(4) },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  title: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 14, color: colors.text, marginTop: spacing(2) },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: spacing(2) },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing(2) },
  info: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: spacing(3), marginTop: spacing(3) },
}));
