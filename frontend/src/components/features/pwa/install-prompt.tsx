/**
 * PWA Install Prompt
 * Shows prompt to install app on home screen/desktop
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger-client";
import { I18n } from "@/locales/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Check if recently dismissed
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < sevenDays) {
          return; // Don't show if dismissed recently
        }
      }
      
      // Wait 30 seconds before showing
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      logger.info("User accepted PWA install prompt");
    } else {
      logger.info("User dismissed PWA install prompt");
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    
    // Don't show again for 7 days
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Card>
        <CardHeader>
          <CardTitle>{I18n.settings.storage.pwa.installPrompt.title}</CardTitle>
          <CardDescription>
            {I18n.settings.storage.pwa.installPrompt.description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-2">
          <Button onClick={handleInstall}>
            {I18n.settings.storage.pwa.installPrompt.install}
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            {I18n.settings.storage.pwa.installPrompt.notNow}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
