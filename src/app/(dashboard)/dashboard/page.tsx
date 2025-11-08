import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserLibraries } from "@/lib/services/library.service";
import { getUserPlaylists } from "@/lib/services/playlist.service";
import { UI_TEXT } from "@/locales/messages";
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

  return (
    <Container padding="md" className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">
            {UI_TEXT.dashboard.navbar.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <LibrariesCard libraries={libraries} />
          <PlaylistsCard playlists={playlists} />
        </CardContent>
      </Card>

      <StorageCard />
    </Container>
  );
}
