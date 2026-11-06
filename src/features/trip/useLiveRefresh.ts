import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Garde un écran à jour des décisions du gestionnaire sans redémarrer l'app : relecture au
 * retour sur l'écran, au retour au premier plan, puis à intervalle tant que l'écran est visible
 * (`intervalMs` = 0 : pas de relecture périodique).
 *
 * Renvoie l'état du tirer-pour-rafraîchir : seule une relecture demandée par le chauffeur
 * affiche l'indicateur, les relectures automatiques restent silencieuses.
 */
export function useLiveRefresh(refresh: () => Promise<unknown> | void, intervalMs = 0) {
  const ref = useRef(refresh);
  useEffect(() => {
    ref.current = refresh;
  });
  const [pulling, setPulling] = useState(false);
  const focused = useRef(false);
  const skipFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      // Le premier affichage charge déjà les données : on ne relit qu'au retour sur l'écran.
      if (skipFirstFocus.current) skipFirstFocus.current = false;
      else void ref.current();
      const timer = intervalMs > 0 ? setInterval(() => void ref.current(), intervalMs) : null;
      return () => {
        focused.current = false;
        if (timer) clearInterval(timer);
      };
    }, [intervalMs])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && focused.current) void ref.current();
    });
    return () => sub.remove();
  }, []);

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await ref.current();
    } finally {
      setPulling(false);
    }
  }, []);

  return { pulling, onPull };
}
