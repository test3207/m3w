/**
 * Settings Page
 * User settings and preferences
 */

import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Mail, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/ui/use-toast";
import { useLocale } from "@/locales/use-locale";
import { I18n } from "@/locales/i18n";

export default function SettingsPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    toast({
      title: I18n.settings.toast.signOutSuccess,
      description: I18n.settings.toast.signOutDescription,
    });
    navigate("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">{I18n.settings.title}</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {I18n.settings.pleaseSignIn}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-full overflow-y-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">{I18n.settings.title}</h1>

      {/* User Profile Section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{I18n.settings.profile.title}</CardTitle>
          <CardDescription>{I18n.settings.profile.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Name */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={user.image || undefined}
                alt={user.name || "User"}
              />
              <AvatarFallback className="text-lg">
                {user.name ? (
                  getInitials(user.name)
                ) : (
                  <UserIcon className="h-8 w-8" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                {user.name || I18n.settings.profile.usernameNotSet}
              </h3>
              {user.email && (
                <p className="text-sm text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* User Details */}
          <div className="space-y-3">
            {user.name && (
              <div className="flex items-center gap-3 text-sm">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {I18n.settings.profile.username}
                </span>
                <span className="font-medium">{user.name}</span>
              </div>
            )}

            {user.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {I18n.settings.profile.email}
                </span>
                <span className="font-medium">{user.email}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Github className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {I18n.settings.profile.loginMethod}
              </span>
              <span className="font-medium">GitHub</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout Section */}
      <Card>
        <CardHeader>
          <CardTitle>{I18n.settings.account.title}</CardTitle>
          <CardDescription>{I18n.settings.account.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {I18n.settings.account.signOut}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
