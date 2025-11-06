import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/signin");
  }
  
  return <>{children}</>;
}
