import { User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

interface PersonalInfoProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function PersonalInfo({ user }: PersonalInfoProps) {
  useLocale();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{I18n.settings.profile.title}</CardTitle>
        <CardDescription>{I18n.settings.profile.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Avatar and Name */}
        <div className="flex items-center gap-3">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
            <AvatarFallback className="text-base">
              {user.name ? getInitials(user.name) : <UserIcon className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-base font-semibold">
              {user.name || I18n.settings.profile.usernameNotSet}
            </h3>
            {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
