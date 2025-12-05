/**
 * Settings Page
 * User settings and preferences
 */

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { useLocale } from "@/locales/use-locale";
import { I18n } from "@/locales/i18n";
import StorageManager from "@/components/features/settings/StorageManager";
import PersonalInfo from "@/components/features/settings/PersonalInfo";
import OfflineSettings from "@/components/features/settings/OfflineSettings";

export default function SettingsPage() {
  useLocale();
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">{I18n.settings.title}</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {I18n.settings.pleaseSignIn}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{I18n.settings.title}</h1>

      <div className="flex flex-col gap-3">
        {/* User Profile Section */}
        <PersonalInfo user={user} />

        {/* Offline Settings Section */}
        <OfflineSettings />

        {/* Storage Management Section */}
        <StorageManager />
      </div>
    </div>
  );
}
