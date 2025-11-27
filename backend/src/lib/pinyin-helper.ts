/**
 * Pinyin Helper
 * Utility functions for Chinese text processing using pinyin-pro
 */

import { pinyin } from 'pinyin-pro';

/**
 * Convert text to Pinyin for sorting
 * Uses pinyin-pro for accurate Chinese character conversion
 * Non-Chinese characters pass through unchanged
 */
export function getPinyinSort(text: string): string {
  return pinyin(text || '', { toneType: 'none' }).toLowerCase();
}
