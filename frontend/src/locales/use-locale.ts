import { useContext, createContext, useEffect, useState } from "react";
import { onLocaleChange, getLocale } from "./i18n";

// Context for locale - exported for LocaleProvider
export const LocaleContext = createContext<string>("en");

/**
 * Hook to force component re-render when locale changes
 * 
 * Tries to use LocaleContext first (recommended).
 * Falls back to direct subscription if used outside LocaleProvider.
 * 
 * @returns Current locale string
 */
export function useLocale(): string {
  // Try to use context first (more efficient, works with React tree)
  const contextLocale = useContext(LocaleContext);
  
  // Also subscribe directly as fallback (for components outside provider)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => {
      forceUpdate(n => n + 1);
    });

    return unsubscribe;
  }, []);

  return contextLocale || getLocale();
}
