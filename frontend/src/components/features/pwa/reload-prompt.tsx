/**
 * PWA Reload Prompt
 * Shows notification when new version is available or app is offline-ready
 */

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

export function ReloadPrompt() {
  useLocale();
  const { offlineReady, needRefresh, updateServiceWorker, close } = useServiceWorker();

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Card>
        <CardHeader>
          <CardTitle>
            {needRefresh 
              ? I18n.settings.storage.pwa.reloadPrompt.newVersionTitle 
              : I18n.settings.storage.pwa.reloadPrompt.offlineReadyTitle}
          </CardTitle>
          <CardDescription>
            {needRefresh
              ? I18n.settings.storage.pwa.reloadPrompt.newVersionDescription
              : I18n.settings.storage.pwa.reloadPrompt.offlineReadyDescription}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-2">
          {needRefresh && (
            <Button onClick={() => updateServiceWorker(true)}>
              {I18n.settings.storage.pwa.reloadPrompt.reload}
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            {I18n.settings.storage.pwa.reloadPrompt.close}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
