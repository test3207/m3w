import { User as UserIcon, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import { I18n } from "@/locales/i18n";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PersonalInfoProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function PersonalInfo({ user }: PersonalInfoProps) {
  const { isOnline } = useNetworkStatus();
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="p-4">
      <Stack direction="horizontal" gap="md" align="center">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
          <AvatarFallback className="text-sm">
            {user.name ? getInitials(user.name) : <UserIcon className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        <Stack gap="none" className="flex-1">
          <Stack direction="horizontal" gap="sm" align="center">
            <Text variant="body" className="font-semibold">
              {user.name || I18n.settings.profile.usernameNotSet}
            </Text>
            {!isOnline && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <WifiOff className="h-4 w-4 text-amber-500" aria-label={I18n.networkStatus.offlineTooltip} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{I18n.networkStatus.offlineTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </Stack>
          {user.email && (
            <Text variant="caption" className="text-muted-foreground">
              {user.email}
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
