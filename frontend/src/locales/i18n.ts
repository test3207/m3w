import type { Messages } from './generated/types';
import { logger } from '@/lib/logger-client';

// Store for all language messages (flat dot-notation keys)
const messagesStore = new Map<string, Record<string, string>>();

// Current active locale
let currentLocale = 'en';

// Locale change listeners
const localeChangeListeners = new Set<() => void>();

/**
 * Flatten nested object to dot notation
 * { a: { b: "text" } } => { "a.b": "text" }
 */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

/**
 * Create nested Proxy that intercepts property access
 * and returns translation for current locale
 */
function createNestedProxy(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        // Ignore symbol properties (like Symbol.toStringTag)
        if (typeof prop === 'symbol') {
          return undefined;
        }

        const newPath = [...path, prop];
        const key = newPath.join('.');

        // Try to get value from current locale
        const messages = messagesStore.get(currentLocale);
        const value = messages?.[key];

        // If found string value, return it
        if (typeof value === 'string') {
          return value;
        }

        // Otherwise, continue nesting Proxy
        return createNestedProxy(newPath);
      },
    }
  );
}

/**
 * Main I18n object with full type safety
 * 
 * Usage:
 * ```ts
 * import { I18n } from '@/locales/i18n';
 * 
 * console.log(I18n.dashboard.title);  // "M3W Dashboard"
 * console.log(I18n.error.unauthorized);  // "Unauthorized"
 * ```
 */
export const I18n = createNestedProxy() as Messages;

/**
 * Register messages for a locale
 * Should be called at app initialization
 * 
 * @param locale - Locale identifier (e.g., 'en', 'zh-CN')
 * @param messages - Nested message object
 */
export function registerMessages(locale: string, messages: Record<string, unknown>): void {
  const flattened = flatten(messages);
  messagesStore.set(locale, flattened);
}

/**
 * Set current active locale
 * All subsequent I18n.xxx accesses will use this locale
 * 
 * @param locale - Locale identifier
 */
export function setLocale(locale: string): void {
  if (!messagesStore.has(locale)) {
    logger.warn('Locale not registered, falling back', { locale, fallback: currentLocale });
    return;
  }
  currentLocale = locale;
  
  // Notify all listeners
  localeChangeListeners.forEach(listener => listener());
}

/**
 * Subscribe to locale changes
 * Returns unsubscribe function
 * 
 * @param listener - Callback function
 * @returns Unsubscribe function
 */
export function onLocaleChange(listener: () => void): () => void {
  localeChangeListeners.add(listener);
  return () => localeChangeListeners.delete(listener);
}

/**
 * Get current active locale
 * 
 * @returns Current locale identifier
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Get list of registered locales
 * 
 * @returns Array of locale identifiers
 */
export function getAvailableLocales(): string[] {
  return Array.from(messagesStore.keys());
}
