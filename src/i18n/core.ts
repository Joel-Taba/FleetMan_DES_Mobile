// Translation without React: usable from pure modules (API client, label maps, dates)
// as well as from components (through useT in ./index.tsx).
import { BASE_DE } from "./base/de";
import { BASE_EN } from "./base/en";
import { BASE_ES } from "./base/es";
import { FOUNDATION_DE, FOUNDATION_EN, FOUNDATION_ES } from "./foundation";
import { SCREENS_DE, SCREENS_EN, SCREENS_ES } from "./screens";
import { EXTRA_DE, EXTRA_EN, EXTRA_ES } from "./extra";

export type Lang = "fr" | "en" | "de" | "es";

/** Languages offered by the selector, each written in its own language. */
export const LANGUAGES: { code: Lang; label: string; short: string; locale: string }[] = [
  { code: "fr", label: "Français", short: "FR", locale: "fr-FR" },
  { code: "en", label: "English", short: "EN", locale: "en-GB" },
  { code: "de", label: "Deutsch", short: "DE", locale: "de-DE" },
  { code: "es", label: "Español", short: "ES", locale: "es-ES" },
];

const EN: Record<string, string> = { ...BASE_EN, ...FOUNDATION_EN, ...SCREENS_EN, ...EXTRA_EN };
const DE: Record<string, string> = { ...BASE_DE, ...FOUNDATION_DE, ...SCREENS_DE, ...EXTRA_DE };
const ES: Record<string, string> = { ...BASE_ES, ...FOUNDATION_ES, ...SCREENS_ES, ...EXTRA_ES };

/** The French text is the key; a missing translation falls back to English, then French. */
export function translate(lang: Lang, fr: string): string {
  if (lang === "fr") return fr;
  if (lang === "de") return DE[fr] ?? EN[fr] ?? fr;
  if (lang === "es") return ES[fr] ?? EN[fr] ?? fr;
  return EN[fr] ?? fr;
}

/** Device language when supported, else English (project charter default). */
export function detectDeviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    const code = locale.slice(0, 2).toLowerCase();
    return LANGUAGES.some((l) => l.code === code) ? (code as Lang) : "en";
  } catch {
    return "en";
  }
}

let currentLang: Lang = detectDeviceLang();

export function setCurrentLang(lang: Lang): void {
  currentLang = lang;
}

export function getCurrentLang(): Lang {
  return currentLang;
}

/** Translation outside React components (label maps, API errors, formatters). */
export function tr(fr: string): string {
  return translate(currentLang, fr);
}

/** BCP 47 locale of the current language, for dates and numbers. */
export function appLocale(): string {
  return LANGUAGES.find((l) => l.code === currentLang)?.locale ?? "en-GB";
}
