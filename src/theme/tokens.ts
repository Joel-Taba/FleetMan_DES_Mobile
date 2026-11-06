import { Platform, StyleSheet, type TextStyle } from "react-native";

import { getColorScheme, type ColorScheme } from "./scheme";

/**
 * Palette claire et sobre : fond gris bleuté très doux, cartes blanches à fine bordure et ombre légère,
 * texte bleu nuit, bleu FleetMan pour les actions. Les couleurs d'état sont foncées pour rester lisibles sur blanc.
 */
const lightColors = {
  bgTop: "#E4F0FA",
  bgMid: "#F1F6FB",
  bgBottom: "#F6F8FB",
  glass: "rgba(255,255,255,0.88)",
  glassStrong: "#FFFFFF",
  glassBorder: "rgba(16,36,58,0.08)",
  text: "#10243A",
  textSecondary: "#4B5D70",
  textMuted: "#8494A6",
  accent: "#2696E4",
  accentSoft: "#1C6FB0",
  ctaFrom: "#3AA3EC",
  ctaTo: "#1F80CE",
  ctaText: "#FFFFFF",
  onAccent: "#FFFFFF",
  /** Remplissages neutres discrets (segments, pistes, fonds d'icônes). */
  track: "rgba(16,36,58,0.07)",
  trackStrong: "rgba(16,36,58,0.12)",
  inputBg: "#F4F7FB",
  overlay: "rgba(16,36,58,0.45)",
  shadow: "#0F3552",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  plateYellow: "#F5D547",
  /** Barre d'onglets flottante et barres d'action collées en bas (fond quasi opaque). */
  barGlass: "rgba(255,255,255,0.94)",
  stickyGlass: "rgba(255,255,255,0.96)",
  /** Halos décoratifs du fond d'écran (ScreenBackground). */
  haloA: "#8CCBF5",
  haloB: "#BFE0F8",
  haloC: "#DCEEFB",
};

export type Palette = { readonly [K in keyof typeof lightColors]: string };

/**
 * Palette sombre, miroir de la claire : fonds marine profond (pas de noir pur), cartes marine un cran
 * plus clair, texte presque blanc, bleu FleetMan éclairci ; couleurs d'état claires pour rester lisibles.
 * Les couleurs passées à tint() restent en hexadécimal.
 */
const darkColors: Palette = {
  bgTop: "#10263A",
  bgMid: "#0C1D2E",
  bgBottom: "#0A1826",
  glass: "rgba(19,40,61,0.86)",
  glassStrong: "#132A40",
  glassBorder: "rgba(160,200,235,0.12)",
  text: "#EAF2FA",
  textSecondary: "#A9BBCD",
  textMuted: "#7C90A5",
  accent: "#4FAEF0",
  accentSoft: "#8CCBF5",
  ctaFrom: "#3AA3EC",
  ctaTo: "#1F80CE",
  ctaText: "#FFFFFF",
  onAccent: "#FFFFFF",
  track: "rgba(234,242,250,0.07)",
  trackStrong: "rgba(234,242,250,0.14)",
  inputBg: "#0E2236",
  overlay: "rgba(2,10,20,0.62)",
  shadow: "#000000",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  plateYellow: "#F5D547",
  barGlass: "rgba(17,36,56,0.95)",
  stickyGlass: "rgba(12,29,46,0.97)",
  haloA: "#2696E4",
  haloB: "#1D6FAE",
  haloC: "#174A73",
};

export const palettes: Record<ColorScheme, Palette> = { light: lightColors, dark: darkColors };

/**
 * Couleurs du thème courant. Chaque propriété est un accesseur qui lit le thème actif : les appels
 * existants `colors.text` restent valables et donnent la bonne valeur au moment du rendu.
 * Ne pas copier une couleur dans une constante de module (elle serait figée) : utiliser
 * themedStyles() / themed() ci-dessous, ou lire `colors.x` pendant le rendu.
 */
export const colors = {} as Palette;
for (const key of Object.keys(lightColors) as (keyof Palette)[]) {
  Object.defineProperty(colors, key, { enumerable: true, get: () => palettes[getColorScheme()][key] });
}

/**
 * Objet de module dépendant du thème (table de couleurs, variantes...). La fabrique est rappelée une
 * fois par thème, au premier accès ; les propriétés sont des accesseurs, l'usage reste `OBJ.cle`.
 */
export function themed<T extends object>(factory: (c: Palette) => T): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  const current = (): T => {
    const s = getColorScheme();
    return (cache[s] ??= factory(palettes[s]));
  };
  const proxy = {} as T;
  for (const key of Object.keys(current()) as (keyof T)[]) {
    Object.defineProperty(proxy, key, { enumerable: true, get: () => current()[key] });
  }
  return proxy;
}

/**
 * StyleSheet.create dépendant du thème : `const styles = themedStyles(() => ({ card: { backgroundColor: colors.glass } }))`.
 * Les composants gardent `style={styles.card}` ; la feuille du thème actif est créée au premier accès.
 */
export function themedStyles<S>(factory: (c: Palette) => S & Parameters<typeof StyleSheet.create>[0]): Readonly<S> {
  return themed((c) => StyleSheet.create(factory(c)) as Readonly<S> & object);
}

/** Ombre douce des cartes (iOS/web) et élévation équivalente (Android). */
export const cardShadow = {
  get shadowColor() {
    return colors.shadow;
  },
  get shadowOpacity() {
    return getColorScheme() === "dark" ? 0.28 : 0.07;
  },
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

/** Translucent tint of a hex color (badges, highlights). */
export function tint(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const radius = { sm: 12, md: 16, lg: 24, xl: 28, pill: 999 } as const;

export const spacing = (n: number) => n * 4;

/** Font family names registered by useFonts in src/app/_layout.tsx. */
export const fonts = {
  display: "Outfit_600SemiBold",
  displayBold: "Outfit_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
} as const;

export const monoFont = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

/** Text style presets (la couleur suit le thème courant à chaque lecture). */
export const type = {
  get hero(): TextStyle {
    return { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, color: colors.text };
  },
  get h1(): TextStyle {
    return { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: colors.text };
  },
  get h2(): TextStyle {
    return { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text };
  },
  get h3(): TextStyle {
    return { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.text };
  },
  get body(): TextStyle {
    return { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text };
  },
  get bodyMedium(): TextStyle {
    return { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: colors.text };
  },
  get small(): TextStyle {
    return { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary };
  },
  get caption(): TextStyle {
    return { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.textMuted };
  },
  get label(): TextStyle {
    return { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18, color: colors.textSecondary };
  },
  get stat(): TextStyle {
    return { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, color: colors.text };
  },
};
