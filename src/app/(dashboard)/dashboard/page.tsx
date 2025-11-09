import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserLibraries } from "@/lib/services/library.service";
import { getUserPlaylists } from "@/lib/services/playlist.service";
import { DASHBOARD_TEXT } from "@/locales/messages";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import {
  LibrariesCard,
  PlaylistsCard,
  StorageCard,
} from "@/components/features/dashboard-cards";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const [libraries, playlists] = await Promise.all([
    getUserLibraries(session.user.id),
    getUserPlaylists(session.user.id),
  ]);

  return (
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="dashboard-overview"
        baseSize={360}
        minSize={240}
        className="pt-4"
      >
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">
              {DASHBOARD_TEXT.navbar.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid flex-1 gap-3 overflow-auto md:grid-cols-2">
            <LibrariesCard libraries={libraries} />
            <PlaylistsCard playlists={playlists} />
          </CardContent>
        </Card>
      </AdaptiveSection>

      <AdaptiveSection
        id="dashboard-storage"
        baseSize={220}
        minSize={160}
        className="pb-4"
        allowOverflow
      >
        <div className="h-full overflow-auto">
          <StorageCard />
        </div>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}
