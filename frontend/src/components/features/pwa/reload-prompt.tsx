/**
 * PWA Reload Prompt
 * Shows notification when new version is available or app is offline-ready
 * Uses both a persistent card and a toast for better visibility
 */

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { toast } from "@/components/ui/use-toast";
import { I18n } from "@/locales/i18n";

export function ReloadPrompt() {
  const { offlineReady, needRefresh, updateServiceWorker, close } = useServiceWorker();
  const hasShownToast = useRef(false);

  // Show toast notification when new version is available
  useEffect(() => {
    if (needRefresh && !hasShownToast.current) {
      hasShownToast.current = true;
      toast({
        title: I18n.settings.storage.pwa.reloadPrompt.newVersionTitle,
        description: I18n.settings.storage.pwa.reloadPrompt.newVersionDescription,
        duration: 10000, // Show for 10 seconds
        action: (
          <Button
            size="sm"
            onClick={() => updateServiceWorker(true)}
          >
            {I18n.settings.storage.pwa.reloadPrompt.reload}
          </Button>
        ),
      });
    }
    
    // Reset flag when needRefresh becomes false
    if (!needRefresh) {
      hasShownToast.current = false;
    }
  }, [needRefresh, updateServiceWorker, close]);

  // Show toast for offline ready (less intrusive)
  useEffect(() => {
    if (offlineReady) {
      toast({
        title: I18n.settings.storage.pwa.reloadPrompt.offlineReadyTitle,
        description: I18n.settings.storage.pwa.reloadPrompt.offlineReadyDescription,
        duration: 5000,
      });
      // Auto-close the offline ready notification
      close();
    }
  }, [offlineReady, close]);

  // Only show persistent card for update prompt, not for offline ready
  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <Card className="border-primary shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {I18n.settings.storage.pwa.reloadPrompt.newVersionTitle}
          </CardTitle>
          <CardDescription className="text-sm">
            {I18n.settings.storage.pwa.reloadPrompt.newVersionDescription}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            {I18n.settings.storage.pwa.reloadPrompt.reload}
          </Button>
          <Button variant="outline" size="sm" onClick={close}>
            {I18n.settings.storage.pwa.reloadPrompt.close}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
