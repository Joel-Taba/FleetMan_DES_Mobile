import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { LANGUAGES, appLocale, getCurrentLang, setCurrentLang, translate, type Lang } from "./core";

export { LANGUAGES, appLocale, tr, translate, type Lang } from "./core";

const STORAGE_KEY = "fm:lang";

type I18nValue = {
  t: (fr: string) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
  locale: string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getCurrentLang());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && saved && LANGUAGES.some((l) => l.code === saved)) {
          setCurrentLang(saved as Lang);
          setLangState(saved as Lang);
        }
      })
      .catch(() => undefined)
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next);
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  // Keeps tr() (non-hook) in sync with the rendered language.
  setCurrentLang(lang);

  const value = useMemo<I18nValue>(
    () => ({ t: (fr: string) => translate(lang, fr), lang, setLang, locale: appLocale() }),
    [lang, setLang]
  );

  // The saved language is read once from storage (fast); the splash screen stays up meanwhile.
  if (!loaded) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT must be used inside <I18nProvider>");
  return value;
}
