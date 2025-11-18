/**
 * Demo Banner Component
 * 
 * Displays a warning banner in demo environments with storage usage and free music links.
 * Only visible when demo mode is enabled at runtime.
 */

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { demo } from '@/services/api/main/resources/demo';
import { IS_DEMO_BUILD } from '@/lib/demo/constants';
import { Stack } from '@/components/ui/stack';
import { Text } from '@/components/ui/text';
import { Separator } from '@/components/ui/separator';
import type { StorageUsageInfo } from '@m3w/shared';

export function DemoBanner() {
  useLocale();
  
  const [storageInfo, setStorageInfo] = useState<StorageUsageInfo | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Only load if this is a demo build
    if (!IS_DEMO_BUILD) return;
    
    // Try to fetch storage info to determine if demo mode is enabled
    demo.getStorageInfo()
      .then(info => {
        setStorageInfo(info);
        setIsEnabled(true);
      })
      .catch(() => {
        // Demo mode not enabled or API error
        setIsEnabled(false);
      });
  }, []);

  // Don't render if not a demo build or not enabled
  if (!IS_DEMO_BUILD || !isEnabled) return null;

  return (
    <aside
      role="banner"
      aria-label="Demo mode notification"
      className="bg-yellow-50 border-b border-yellow-200 px-4 py-2"
    >
      <Stack
        direction="horizontal"
        gap="md"
        align="center"
        justify="center"
        wrap
      >
        {/* Warning message */}
        <Stack direction="horizontal" gap="sm" align="center">
          <AlertCircle className="h-4 w-4 shrink-0 text-yellow-800" aria-hidden="true" />
          <Text as="span" className="text-sm text-yellow-800">
            {I18n.demo.bannerMessage}
          </Text>
        </Stack>
        
        {/* Storage usage */}
        {storageInfo && (
          <>
            <Separator orientation="vertical" className="h-4 bg-yellow-300" aria-hidden="true" />
            <Text as="span" className="text-xs text-yellow-800" aria-label={`Storage usage: ${storageInfo.usedFormatted} of ${storageInfo.limitFormatted} used, ${storageInfo.percentage} percent`}>
              <span aria-hidden="true">
                {I18n.demo.storageUsage}: {storageInfo.usedFormatted} / {storageInfo.limitFormatted}
                <span className="ml-1 text-yellow-600">({storageInfo.percentage}%)</span>
              </span>
            </Text>
          </>
        )}
        
        {/* Free music resources */}
        <Separator orientation="vertical" className="h-4 bg-yellow-300" aria-hidden="true" />
        <nav aria-label="Free music resources">
          <ul className="flex flex-row items-center gap-1 text-xs list-none m-0 p-0">
            <li>
              <a 
                href="https://freemusicarchive.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-800 underline hover:text-yellow-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 rounded"
              >
                Free Music Archive
              </a>
            </li>
            <li aria-hidden="true" className="text-yellow-600">·</li>
            <li>
              <a 
                href="https://musopen.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-800 underline hover:text-yellow-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 rounded"
              >
                Musopen
              </a>
            </li>
            <li aria-hidden="true" className="text-yellow-600">·</li>
            <li>
              <a 
                href="https://ccmixter.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-800 underline hover:text-yellow-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 rounded"
              >
                ccMixter
              </a>
            </li>
          </ul>
        </nav>
      </Stack>
    </aside>
  );
}
