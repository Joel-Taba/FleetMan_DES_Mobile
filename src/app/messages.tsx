import { router } from "expo-router";
import { CheckCheck, Clock, Megaphone, MessageCircle, SendHorizontal } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isQueued } from "@/api/client";
import { sendMyMessage } from "@/api/driver";
import type { DriverMessage } from "@/api/types";
import { AppHeader, EmptyState, ErrorState, GlassView, LoadingState, ScreenBackground } from "@/components/ui";
import { useT } from "@/i18n";
import { formatDate, formatTime } from "@/i18n/format";
import { InlineMessage } from "@/features/common/InlineMessage";
import { errorMessage } from "@/features/common/media";
import { useDriverProfile } from "@/features/driver/hooks";
import { useMyMessages } from "@/features/messages/hooks";
import { queuedMessage, usePendingActions } from "@/features/offline/hooks";
import { useLiveRefresh } from "@/features/trip/useLiveRefresh";
import { colors, fonts, radius, spacing, tint, themedStyles } from "@/theme/tokens";

/** Limite du serveur pour un message. */
const MAX_LENGTH = 2000;

/**
 * Messagerie avec le gestionnaire de flotte : fil de discussion (chauffeur à droite, gestionnaire
 * à gauche), messages diffusés à toute la flotte, accusé « Lu » et zone de saisie en bas.
 */
export default function MessagesScreen() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const messages = useMyMessages();
  const profile = useDriverProfile();
  // Messages written offline: shown at the end of the thread until the queue sends them.
  const queuedItems = usePendingActions("message");
  const queuedList: DriverMessage[] = queuedItems.map((q) => ({
    id: `queued-${q.id}`,
    driverId: "",
    senderId: "",
    senderName: null,
    fromDriver: true,
    body: String((q.body as { body?: unknown } | undefined)?.body ?? ""),
    broadcast: false,
    readAt: null,
    createdAt: new Date(q.createdAt).toISOString(),
  }));
  const list = [...(messages.data ?? []), ...queuedList];
  const queuedIds = new Set(queuedList.map((m) => m.id));

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Relecture au retour sur l'écran, au premier plan et toutes les 20 s tant qu'il est ouvert.
  const { pulling, onPull } = useLiveRefresh(messages.refetch, 20_000);

  // Défilement vers le dernier message : au premier affichage, à chaque nouveau message, au clavier.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const shownCount = useRef(0);
  function onContentSizeChange() {
    if (list.length === shownCount.current) return;
    scrollRef.current?.scrollToEnd({ animated: shownCount.current > 0 });
    shownCount.current = list.length;
  }
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => sub.remove();
  }, []);

  const lastManager = [...list].reverse().find((m) => !m.fromDriver && !m.broadcast && m.senderName);
  const fleetName = profile.data?.fleetName;
  const subtitle = [lastManager?.senderName ?? t("Votre gestionnaire"), fleetName].filter(Boolean).join(" · ");

  const body = draft.trim();
  const canSend = body.length > 0 && body.length <= MAX_LENGTH && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sendMyMessage(body);
      setDraft("");
      if (isQueued(result)) setNotice(queuedMessage());
      else await messages.refetch();
    } catch (err) {
      setError(errorMessage(err, "Envoi impossible."));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={{ paddingTop: insets.top }}>
          <AppHeader title={t("Messages")} subtitle={subtitle} onBack={() => router.back()} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={onContentSizeChange}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={() => void onPull()}
              tintColor={colors.accentSoft}
              colors={[colors.accent]}
              progressBackgroundColor={colors.bgMid}
            />
          }
        >
          {messages.loading && !messages.data ? (
            <LoadingState />
          ) : messages.error && !messages.data && queuedList.length === 0 ? (
            <ErrorState message={messages.error} onRetry={() => void messages.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title={t("Aucun message pour le moment.")}
              message={t("Écrivez à votre gestionnaire pour toute question.")}
            />
          ) : (
            list.map((m, i) => {
              const day = formatDate(m.createdAt);
              const newDay = i === 0 || formatDate(list[i - 1].createdAt) !== day;
              return (
                <View key={m.id}>
                  {newDay ? <Text style={styles.day}>{day}</Text> : null}
                  <Bubble message={m} queued={queuedIds.has(m.id)} />
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.composerBox, { paddingBottom: insets.bottom + spacing(2) }]}>
          <InlineMessage text={error} />
          <InlineMessage text={notice} tone="info" />
          <GlassView strong style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (error) setError(null);
              }}
              placeholder={t("Écrire un message…")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_LENGTH}
              selectionColor={colors.accent}
              textAlignVertical="center"
              accessibilityLabel={t("Écrire un message…")}
              style={[styles.input, Platform.OS === "web" && webNoOutline]}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t("Envoyer")}
              accessibilityState={{ disabled: !canSend, busy: sending }}
              hitSlop={6}
              style={({ pressed }) => [styles.send, { opacity: !canSend && !sending ? 0.4 : pressed ? 0.8 : 1 }]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <SendHorizontal size={20} color={colors.text} strokeWidth={2.2} />
              )}
            </Pressable>
          </GlassView>
          {draft.length >= MAX_LENGTH - 200 ? (
            <Text style={[styles.counter, draft.length >= MAX_LENGTH && { color: colors.warning }]}>
              {draft.length} / {MAX_LENGTH}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message: m, queued = false }: { message: DriverMessage; queued?: boolean }) {
  const { t } = useT();
  const mine = m.fromDriver;
  const content = (
    <>
      {m.broadcast ? (
        <View style={styles.broadcast}>
          <Megaphone size={12} color={colors.warning} />
          <Text style={styles.broadcastText}>{t("Message à toute la flotte")}</Text>
        </View>
      ) : null}
      <Text style={[styles.sender, mine && { color: tint("#FFFFFF", 0.85) }]} numberOfLines={1}>
        {mine ? t("Vous") : m.senderName || t("Gestionnaire")}
      </Text>
      <Text style={[styles.body, mine && { color: colors.onAccent }]} selectable>
        {m.body}
      </Text>
      <Text style={[styles.time, mine && { color: tint("#FFFFFF", 0.75) }]}>{formatTime(m.createdAt)}</Text>
    </>
  );

  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
      {mine ? (
        <View style={[styles.bubble, styles.mine, queued && { opacity: 0.7 }]}>{content}</View>
      ) : (
        <GlassView strong style={[styles.bubble, styles.theirs, m.broadcast && { borderColor: tint(colors.warning, 0.45) }]}>
          {content}
        </GlassView>
      )}
      {queued ? (
        <View style={styles.read}>
          <Clock size={12} color={colors.warning} />
          <Text style={[styles.readText, { color: colors.warning }]}>{t("En attente d'envoi")}</Text>
        </View>
      ) : null}
      {mine && m.readAt ? (
        <View style={styles.read}>
          <CheckCheck size={13} color={colors.accentSoft} />
          <Text style={styles.readText}>{t("Lu")}</Text>
        </View>
      ) : null}
    </View>
  );
}

// The focus state is visible through the caret; hide the browser outline on web.
const webNoOutline = { outlineStyle: "none" } as unknown as TextStyle;

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  flex: { flex: 1 },
  thread: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: spacing(4), paddingTop: spacing(2), paddingBottom: spacing(3), gap: spacing(2) },
  day: {
    alignSelf: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  bubbleRow: { maxWidth: "82%" },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  left: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: spacing(3.5), paddingVertical: spacing(2.5), borderRadius: radius.md + 2 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { borderBottomLeftRadius: 6 },
  broadcast: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: tint(colors.warning, 0.14),
    marginBottom: spacing(1.5),
  },
  broadcastText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.warning },
  sender: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accentSoft, marginBottom: 2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  time: { alignSelf: "flex-end", fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: spacing(1) },
  read: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3, marginRight: 2 },
  readText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.accentSoft },
  composerBox: { paddingHorizontal: spacing(4), paddingTop: spacing(2), gap: spacing(2) },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
    borderRadius: radius.lg,
    paddingLeft: spacing(4),
    paddingRight: spacing(1.5),
    paddingVertical: spacing(1.5),
  },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: 120,
    minHeight: 40,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: { alignSelf: "flex-end", fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginRight: spacing(2) },
}));
