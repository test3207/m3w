import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { MiniPlayer } from "@/components/features/mini-player";
import { PlaybackInitializer } from "@/components/features/playback-initializer";
import { DashboardNavbar } from "@/components/layouts/dashboard-navbar";
import { DashboardLayoutShell } from "@/components/layouts/dashboard-layout-shell";

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
    <DashboardLayoutShell
      header={
        <>
          <PlaybackInitializer />
          <DashboardNavbar session={session} />
        </>
      }
      footer={<MiniPlayer />}
    >
      {children}
    </DashboardLayoutShell>
  );
}
