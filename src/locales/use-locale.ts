import { useEffect, useState } from 'react';
import { onLocaleChange } from './i18n';

/**
 * Hook to force component re-render when locale changes
 * Use this in components that display I18n.xxx text
 * 
 * @returns Current locale (for dependency tracking)
 */
export function useLocale(): string {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => {
      forceUpdate(n => n + 1);
    });

    return unsubscribe;
  }, []);

  // Return empty string just to have a stable value
  // The actual locale is accessed via I18n.xxx
  return '';
}
