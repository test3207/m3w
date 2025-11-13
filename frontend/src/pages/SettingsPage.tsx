/**
 * Settings Page
 * User settings and preferences
 */

import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">设置</h1>

      <div className="rounded-lg border bg-card p-6">
        <div className="text-center">
          <SettingsIcon className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">设置页面正在开发中</p>
        </div>
      </div>
    </div>
  );
}
