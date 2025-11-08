import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { MiniPlayer } from "@/components/features/mini-player";
import { PlaybackInitializer } from "@/components/features/playback-initializer";
import { DashboardNavbar } from "@/components/layouts/dashboard-navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return (
  <div className="flex min-h-screen max-h-screen flex-col overflow-hidden bg-background">
      <PlaybackInitializer />
      <DashboardNavbar session={session} />
      <div className="flex-1 min-h-0 overflow-y-auto pb-(--mini-player-height)">
        {children}
      </div>
      <MiniPlayer />
    </div>
  );
}
