import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";

/**
 * Thème de l'application : préférence du chauffeur (« light », « dark » ou « system »), gardée sur
 * l'appareil (AsyncStorage), et thème réellement affiché (le système est résolu via Appearance).
 *
 * Store de module (sans provider) : `colors` (tokens.ts) le lit à chaque accès, et les hooks
 * ci-dessous permettent à n'importe quel composant, même au-dessus de <ThemeProvider>, de suivre le thème.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "fleetman.theme";

function readSystem(): ColorScheme {
  try {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

let preference: ThemePreference = "system";
let systemScheme: ColorScheme = readSystem();
let scheme: ColorScheme = systemScheme;
const listeners = new Set<() => void>();

function recompute() {
  scheme = preference === "system" ? systemScheme : preference;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Thème affiché en ce moment (lecture synchrone, hors React). */
export function getColorScheme(): ColorScheme {
  return scheme;
}

export function getThemePreference(): ThemePreference {
  return preference;
}

/** Change la préférence et la mémorise sur l'appareil. */
export function setThemePreference(next: ThemePreference) {
  preference = next;
  recompute();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
}

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

let hydrated = false;
/** Lecture de la préférence enregistrée, lancée dès l'import du module. */
export const themeHydration: Promise<void> = AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (isPreference(saved)) preference = saved;
  })
  .catch(() => undefined)
  .finally(() => {
    hydrated = true;
    recompute();
  });

export function isThemeHydrated(): boolean {
  return hydrated;
}

try {
  Appearance.addChangeListener(({ colorScheme }) => {
    systemScheme = colorScheme === "dark" ? "dark" : "light";
    if (preference === "system") recompute();
  });
} catch {
  // Appearance indisponible : le thème système reste « clair ».
}

/** Thème affiché (« light » | « dark »), mis à jour à chaque changement. */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribe, getColorScheme, getColorScheme);
}

/** Préférence du chauffeur et son setter (écran Profil). */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const value = useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
  return [value, setThemePreference];
}
