// Partage de la position du chauffeur pendant un trajet en cours (premier plan uniquement).
//
// Un seul suiveur pour toute l'app (module) : il continue quand le chauffeur quitte l'écran de la
// tournée, se met en pause quand l'app passe en arrière-plan et reprend au retour. Il s'arrête de
// lui-même quand le serveur indique que le trajet n'est plus en cours (retour enregistré, annulé…)
// ou que la session n'est plus valable. Le suivi en arrière-plan (app fermée ou écran éteint)
// demande une build de développement avec expo-task-manager : hors du périmètre actuel.
import * as Location from "expo-location";
import { AppState, Platform, type AppStateStatus, type NativeEventSubscription } from "react-native";

import { ApiError } from "@/api/client";
import { sendTripTelemetry } from "@/api/driver";
import { onSessionUserChange } from "@/auth/session";

/** Intervalle d'envoi (le serveur ignore les points à moins de 15 s du précédent). */
export const TRACKING_INTERVAL_MS = 30_000;

export type TrackingStatus =
  /** Aucun partage en cours. */
  | "idle"
  /** Partage actif (app au premier plan). */
  | "sharing"
  /** Partage suspendu : app en arrière-plan. */
  | "paused"
  /** Localisation refusée pour l'app. */
  | "denied"
  /** Localisation (GPS) désactivée sur le téléphone. */
  | "servicesOff";

export type TrackingState = {
  status: TrackingStatus;
  tripId: string | null;
  /** Dernier point accepté par le serveur (ms depuis epoch). */
  lastSentAt: number | null;
  /** Dernier envoi perdu faute de réseau (ms depuis epoch), effacé au prochain envoi réussi. */
  lastFailedAt: number | null;
};

let state: TrackingState = { status: "idle", tripId: null, lastSentAt: null, lastFailedAt: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let sessionUnsub: (() => void) | null = null;
let inFlight = false;

function setState(patch: Partial<TrackingState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getTrackingState(): TrackingState {
  return state;
}

export function subscribeTracking(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function speedKmh(speed: number | null | undefined): number | null {
  // m/s côté téléphone ; iOS renvoie -1 quand la vitesse est inconnue.
  return speed != null && Number.isFinite(speed) && speed >= 0 ? Math.round(speed * 3.6 * 10) / 10 : null;
}

async function readPosition(): Promise<Location.LocationObject | null> {
  if (Platform.OS !== "web") {
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 20_000, requiredAccuracy: 200 }).catch(() => null);
    if (recent) return recent;
  }
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
}

/** Erreur définitive : le trajet n'est plus en cours, n'est plus le sien, ou la session a expiré. */
function isTerminal(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 401 || err.status === 403 || err.status === 404 || err.status === 422;
}

async function tick() {
  const tripId = state.tripId;
  if (!tripId || inFlight || AppState.currentState !== "active") return;
  inFlight = true;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      setState({ status: "denied" });
      return;
    }
    if (Platform.OS !== "web" && !(await Location.hasServicesEnabledAsync().catch(() => true))) {
      setState({ status: "servicesOff" });
      return;
    }
    const position = await readPosition();
    if (!position || state.tripId !== tripId) return;
    const ack = await sendTripTelemetry(tripId, {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      speed: speedKmh(position.coords.speed),
      accuracy: position.coords.accuracy ?? null,
    });
    if (state.tripId !== tripId) return;
    // Un point ignoré (trop rapproché) ou une réponse inattendue ne change pas l'état affiché.
    const accepted = typeof ack === "object" && ack !== null && "accepted" in ack && ack.accepted === true;
    setState({ status: "sharing", ...(accepted ? { lastSentAt: Date.now(), lastFailedAt: null } : {}) });
  } catch (err) {
    if (state.tripId !== tripId) return;
    if (isTerminal(err)) {
      stopTracking();
      return;
    }
    // Hors réseau ou erreur passagère : le point est perdu, le suivant partira dans 30 s.
    setState({ status: "sharing", lastFailedAt: Date.now() });
  } finally {
    inFlight = false;
  }
}

function onAppState(next: AppStateStatus) {
  if (!state.tripId) return;
  if (next === "active") {
    if (state.status === "paused") setState({ status: "sharing" });
    void tick();
  } else if (state.status === "sharing") {
    setState({ status: "paused" });
  }
}

/**
 * Démarre (ou garde) le partage pour ce trajet. La permission doit déjà être accordée :
 * sinon l'état passe à « denied » sans rien demander (la demande se fait depuis la carte d'explication).
 */
export function startTracking(tripId: string) {
  if (state.tripId === tripId && timer && state.status !== "denied" && state.status !== "servicesOff") return;
  stopTimers();
  setState({
    tripId,
    status: AppState.currentState === "active" ? "sharing" : "paused",
    ...(state.tripId !== tripId ? { lastSentAt: null, lastFailedAt: null } : {}),
  });
  timer = setInterval(() => void tick(), TRACKING_INTERVAL_MS);
  appStateSub = AppState.addEventListener("change", onAppState);
  // Déconnexion ou changement de compte : plus rien n'est envoyé.
  sessionUnsub = onSessionUserChange((user) => {
    if (!user) stopTracking();
  });
  void tick();
}

function stopTimers() {
  if (timer) clearInterval(timer);
  timer = null;
  appStateSub?.remove();
  appStateSub = null;
  sessionUnsub?.();
  sessionUnsub = null;
}

/** Arrête tout partage (trajet terminé, partage désactivé par le chauffeur, déconnexion). */
export function stopTracking() {
  stopTimers();
  if (state.status !== "idle" || state.tripId) {
    setState({ status: "idle", tripId: null });
  }
}

/** Relance immédiatement un envoi (après un retour de permission depuis les réglages). */
export function retryTrackingNow() {
  if (!state.tripId) return;
  setState({ status: AppState.currentState === "active" ? "sharing" : "paused" });
  void tick();
}
