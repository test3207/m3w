/**
 * i18n Initialization
 * 
 * Registers all available locale messages.
 * Import this at app startup (e.g., in root layout).
 */

import { registerMessages } from './i18n';
import enMessages from './messages/en.json';
import zhCNMessages from './messages/zh-CN.json';

// Register English (default locale)
registerMessages('en', enMessages);

// Register Chinese Simplified
registerMessages('zh-CN', zhCNMessages);
