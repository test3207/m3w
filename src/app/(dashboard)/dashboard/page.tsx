import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserLibraries } from "@/lib/services/library.service";
import { getUserPlaylists } from "@/lib/services/playlist.service";
import { UI_TEXT } from "@/locales/messages";
import { DashboardNavbar } from "@/components/layouts/dashboard-navbar";
import { Container } from "@/components/ui/container";
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

  const greetingName =
    session.user.name?.split(" ")[0] || UI_TEXT.dashboard.welcomeFallback;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar session={session} />

      <main>
        <Container maxWidth="2xl" padding="lg" className="space-y-8 pb-28 pt-6 md:pb-32">
          <section>
            <Card className="relative overflow-hidden border-none bg-linear-to-br from-primary/10 via-primary/5 to-transparent">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 right-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl"
              />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-semibold sm:text-3xl">
                      {UI_TEXT.dashboard.welcomePrefix}
                      {greetingName}
                      {UI_TEXT.dashboard.welcomeSuffix}
                    </CardTitle>
                    <CardDescription className="max-w-prose text-sm sm:text-base">
                      {UI_TEXT.dashboard.welcomeDescription}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="self-start rounded-full px-3 py-1 text-xs sm:self-center">
                    {UI_TEXT.dashboard.badgeProductionReady}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <LibrariesCard libraries={libraries} />
              <PlaylistsCard playlists={playlists} />
            </div>
            <StorageCard />
          </section>
        </Container>
      </main>
    </div>
  );
}
