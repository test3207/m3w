'use client';

import { Languages } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getLocale, setLocale, getAvailableLocales, onLocaleChange } from '@/locales/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const LOCALE_NAMES: Record<string, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
};

export function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState<string>(getLocale());
  const availableLocales = getAvailableLocales();

  useEffect(() => {
    // Subscribe to locale changes
    const unsubscribe = onLocaleChange(() => {
      setCurrentLocale(getLocale());
    });
    
    return unsubscribe;
  }, []);

  // Only show switcher if multiple languages available
  if (availableLocales.length <= 1) {
    return null;
  }

  const handleLocaleChange = (locale: string) => {
    setLocale(locale);
    // State will be updated via onLocaleChange listener
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Switch language"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableLocales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={currentLocale === locale ? 'bg-accent' : ''}
          >
            {LOCALE_NAMES[locale] || locale}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
