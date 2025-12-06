/**
 * Locale Provider Component
 * 
 * Subscribes to locale changes at the root level.
 * When locale changes, this component re-renders, causing the entire
 * child tree to re-render with updated I18n.xxx values.
 * 
 * This eliminates the need to call useLocale() in every component
 * that uses internationalized text.
 */

import { useLocale } from '@/locales/use-locale';

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  // Subscribe to locale changes at root level
  // When locale changes, this triggers a re-render of the entire child tree
  useLocale();

  return <>{children}</>;
}
