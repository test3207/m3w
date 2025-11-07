/**
 * Example: Refactored Dashboard Navigation using semantic Stack components
 * 
 * Benefits:
 * 1. Semantic HTML (nav element instead of div)
 * 2. Cleaner JSX (no inline flex classes)
 * 3. Better accessibility
 * 4. Reusable layout patterns
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HStack, VStack } from "@/components/ui/stack";
import { UI_TEXT } from "@/locales/messages";

interface DashboardNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  userInitials: string;
  onSignOut: () => void;
}

export function DashboardNav({ user, userInitials, onSignOut }: DashboardNavProps) {
  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <HStack justify="between" className="h-16">
          {/* Logo/Title */}
          <h1 className="text-xl font-bold">
            {UI_TEXT.dashboard.navbar.title}
          </h1>

          {/* User Section */}
          <HStack gap="md">
            {/* User Info */}
            <HStack gap="sm">
              <Avatar>
                <AvatarImage
                  src={user.image || undefined}
                  alt={user.name || "User"}
                />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              
              <VStack gap="none" className="hidden sm:block">
                <p className="text-sm font-medium">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.email}
                </p>
              </VStack>
            </HStack>

            <Separator orientation="vertical" className="h-8" />

            {/* Sign Out Button */}
            <form action={onSignOut}>
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
