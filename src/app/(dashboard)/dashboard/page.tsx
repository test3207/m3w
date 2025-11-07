import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserLibraries } from "@/lib/services/library.service";
import { getUserPlaylists } from "@/lib/services/playlist.service";
import { UI_TEXT } from "@/locales/messages";
import { DashboardNavbar } from "@/components/layouts/dashboard-navbar";
import { Container } from "@/components/ui/container";
import { VStack, HStack } from "@/components/ui/stack";
import {
  LibrariesCard,
  PlaylistsCard,
  GettingStartedCard,
  StorageCard,
  QuickActionsCard,
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
    <div className="min-h-screen bg-background">
      <DashboardNavbar session={session} />

      <main>
        <Container className="py-8">
          <VStack gap="lg">
            {/* Welcome Card */}
            <Card>
              <CardHeader>
                <HStack align="center" justify="between" className="flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl">
                      {UI_TEXT.dashboard.welcomePrefix}
                      {session.user.name?.split(" ")[0] || UI_TEXT.dashboard.welcomeFallback}
                      {UI_TEXT.dashboard.welcomeSuffix}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {UI_TEXT.dashboard.welcomeDescription}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="hidden sm:block">
                    {UI_TEXT.dashboard.badgeProductionReady}
                  </Badge>
                </HStack>
              </CardHeader>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Libraries Overview */}
              <LibrariesCard libraries={libraries} />

              {/* Playlists Overview */}
              <PlaylistsCard playlists={playlists} />

              {/* Getting Started */}
              <GettingStartedCard />

              {/* Storage */}
              <StorageCard />

              {/* Quick Actions */}
              <div className="md:col-span-2 lg:col-span-1">
                <QuickActionsCard />
              </div>
            </div>
          </VStack>
        </Container>
      </main>
    </div>
  );
}
