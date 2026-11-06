import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Relit les données à chaque retour sur l'écran (pas au premier affichage, déjà chargé) : un poste
 * modifié, un véhicule réattribué ou une pièce contrôlée par le gestionnaire apparaît sans tirer
 * pour rafraîchir.
 */
export function useRefetchOnFocus(...refetchers: (() => unknown)[]) {
  const latest = useRef(refetchers);
  useEffect(() => {
    latest.current = refetchers;
  });
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (seen.current) for (const refetch of latest.current) void refetch();
      seen.current = true;
    }, [])
  );
}
