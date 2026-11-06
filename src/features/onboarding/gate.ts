import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { fetchOnboarding } from "@/api/registration";

/**
 * Inscription terminée ou non pour le chauffeur connecté. Tant qu'elle ne l'est pas, l'application
 * n'ouvre que l'écran de finalisation (profil et pièces obligatoires) et le dépôt de pièces.
 * Hors ligne, la dernière réponse connue est utilisée ; sans réponse connue l'accès reste ouvert
 * (le serveur refuse de toute façon d'engager un chauffeur dont le dossier n'est pas validé).
 */
const KEY = (userId: string) => `fm:onboarded:${userId}`;
const listeners = new Set<(userId: string, done: boolean) => void>();

/** Identifiant de connexion du compte qui vient d'être activé (affiché une fois). */
let activatedUsername: string | null = null;

export function rememberActivatedUsername(username: string) {
  activatedUsername = username;
}

export function consumeActivatedUsername(): string | null {
  const value = activatedUsername;
  activatedUsername = null;
  return value;
}

export function setOnboarded(userId: string, done: boolean) {
  AsyncStorage.setItem(KEY(userId), done ? "1" : "0").catch(() => undefined);
  listeners.forEach((l) => l(userId, done));
}

/** null : pas encore connu (le premier écran attend la réponse). */
export function useOnboarded(userId: string | undefined): boolean | null {
  const [state, setState] = useState<{ userId: string; done: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const listener = (id: string, done: boolean) => {
      if (id === userId) setState({ userId, done });
    };
    listeners.add(listener);
    fetchOnboarding()
      .then((s) => {
        if (!active) return;
        setOnboarded(userId, s.completed);
      })
      .catch(async () => {
        const cached = await AsyncStorage.getItem(KEY(userId)).catch(() => null);
        if (active) setState({ userId, done: cached !== "0" });
      });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [userId]);

  if (!userId) return null;
  return state && state.userId === userId ? state.done : null;
}
