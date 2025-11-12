/**
 * PWA Reload Prompt
 * Shows notification when new version is available or app is offline-ready
 */

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useServiceWorker } from '@/hooks/useServiceWorker';

export function ReloadPrompt() {
  const { offlineReady, needRefresh, updateServiceWorker, close } = useServiceWorker();

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Card>
        <CardHeader>
          <CardTitle>
            {needRefresh ? 'New Version Available' : 'App Ready to Work Offline'}
          </CardTitle>
          <CardDescription>
            {needRefresh
              ? 'Click reload to update to the latest version'
              : 'Your music library is now available offline'}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-2">
          {needRefresh && (
            <Button onClick={() => updateServiceWorker(true)}>
              Reload
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
