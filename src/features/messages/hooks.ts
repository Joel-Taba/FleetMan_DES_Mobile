// Messagerie chauffeur ↔ gestionnaire : fil et compteur de messages non lus.
import { fetchMyMessages, fetchMyUnreadMessageCount } from "@/api/driver";
import type { DriverMessage, MessageUnreadCount } from "@/api/types";
import { useDriverId } from "@/features/driver/hooks";
import { useApiQuery } from "@/hooks/useApiQuery";

/** Fil avec le gestionnaire ; chaque lecture marque ses messages comme lus côté serveur. */
export function useMyMessages() {
  const driverId = useDriverId();
  return useApiQuery<DriverMessage[]>(`driver:messages:${driverId}`, () => fetchMyMessages(), [driverId], {
    enabled: Boolean(driverId),
  });
}

/** Messages du gestionnaire pas encore lus (raccourci de l'accueil). */
export function useUnreadMessageCount() {
  const driverId = useDriverId();
  return useApiQuery<MessageUnreadCount>(`driver:messages-unread:${driverId}`, () => fetchMyUnreadMessageCount(), [driverId], {
    enabled: Boolean(driverId),
  });
}
