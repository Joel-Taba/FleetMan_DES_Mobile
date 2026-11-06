import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";

import { isThemeHydrated, themeHydration, useColorScheme } from "./scheme";
import { palettes } from "./tokens";

/**
 * Applique le thème à tout le sous-arbre.
 *
 * - Attend la lecture de la préférence enregistrée (quelques ms, l'écran de démarrage est encore affiché)
 *   pour ne pas afficher un écran clair puis sombre.
 * - Au changement de thème, le sous-arbre est remonté (clé = thème) : les composants relisent `colors`
 *   et les feuilles themedStyles() du nouveau thème. L'état de navigation est conservé par le
 *   conteneur de navigation (racine expo-router) ; seul l'état local des écrans est réinitialisé.
 * - La barre d'état et le fond racine suivent le thème.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [ready, setReady] = useState(isThemeHydrated());

  useEffect(() => {
    if (ready) return;
    let alive = true;
    void themeHydration.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <View key={scheme} style={{ flex: 1, backgroundColor: palettes[scheme].bgBottom }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}
