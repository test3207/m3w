import { signOut } from "@/lib/auth/config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HStack, VStack } from "@/components/ui/stack";
import { UI_TEXT } from "@/locales/messages";
import type { Session } from "next-auth";

interface DashboardNavbarProps {
  session: Session;
}

export function DashboardNavbar({ session }: DashboardNavbarProps) {
  const userInitials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : session.user.email?.[0].toUpperCase() || "U";

  return (
    <nav className="border-b bg-card" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <HStack justify="between" className="h-16">
          <h1 className="text-xl font-bold">{UI_TEXT.dashboard.navbar.title}</h1>

          <HStack gap="md">
            <HStack gap="sm">
              <Avatar>
                <AvatarImage
                  src={session.user.image || undefined}
                  alt={session.user.name || "User"}
                />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>

              <VStack gap="none" className="hidden sm:block">
                <p className="text-sm font-medium">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-xs text-muted-foreground">{session.user.email}</p>
              </VStack>
            </HStack>

            <Separator orientation="vertical" className="h-8" />

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                {UI_TEXT.dashboard.navbar.signOut}
              </Button>
            </form>
          </HStack>
        </HStack>
      </div>
    </nav>
  );
}
