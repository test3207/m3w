import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { MiniPlayer } from "@/components/features/mini-player";

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
    <div className="pb-24">
      {children}
      <MiniPlayer />
    </div>
  );
}
