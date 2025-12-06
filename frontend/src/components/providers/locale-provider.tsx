/**
 * Locale Provider Component
 *
 * Provides locale context for the app. Components that need to react
 * to locale changes should call useLocale() hook.
 *
 * Note: We don't force re-render of the entire tree to avoid disrupting
 * audio playback. Instead, layout components and pages should call useLocale().
 */

import { useEffect, useState } from "react";
import { onLocaleChange, getLocale } from "@/locales/i18n";
import { LocaleContext } from "@/locales/use-locale";

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocale] = useState(getLocale);

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => {
      setLocale(getLocale());
    });
    return unsubscribe;
  }, []);

  return (
    <LocaleContext.Provider value={locale}>
      {children}
    </LocaleContext.Provider>
  );
}
