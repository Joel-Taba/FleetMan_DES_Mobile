// Choix du chauffeur pour le partage de sa position pendant la tournée, mémorisé par compte.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TrackingConsent = "granted" | "declined";

const KEY = "fleetman.tracking.consent";

function keyFor(userId: string | null | undefined) {
  return `${KEY}:${userId ?? "anon"}`;
}

export async function readTrackingConsent(userId: string | null | undefined): Promise<TrackingConsent | null> {
  try {
    const value = await AsyncStorage.getItem(keyFor(userId));
    return value === "granted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export async function saveTrackingConsent(userId: string | null | undefined, consent: TrackingConsent): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), consent);
  } catch {
    // Choix non mémorisé : il sera redemandé au prochain lancement.
  }
}
