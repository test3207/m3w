'use client';

import { registerMessages } from '@/locales/i18n';
import enMessages from '@/locales/messages/en.json';
import zhCNMessages from '@/locales/messages/zh-CN.json';

// Initialize i18n immediately when module loads
registerMessages('en', enMessages);
registerMessages('zh-CN', zhCNMessages);

/**
 * I18n Provider - Ensures i18n is initialized
 * The actual initialization happens at module load time above
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
