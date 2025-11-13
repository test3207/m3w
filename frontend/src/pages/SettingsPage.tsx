/**
 * Settings Page
 * User settings and preferences
 */

import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Mail, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/locales/use-locale';

export default function SettingsPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    toast({
      title: '已退出登录',
      description: '您已成功退出登录',
    });
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">设置</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">请先登录</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      {/* User Profile Section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>您的账户信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Name */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
              <AvatarFallback className="text-lg">
                {user.name ? getInitials(user.name) : <UserIcon className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{user.name || '未设置用户名'}</h3>
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
                <span className="text-muted-foreground">用户名：</span>
                <span className="font-medium">{user.name}</span>
              </div>
            )}

            {user.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">邮箱：</span>
                <span className="font-medium">{user.email}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Github className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">登录方式：</span>
              <span className="font-medium">GitHub</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout Section */}
      <Card>
        <CardHeader>
          <CardTitle>账户操作</CardTitle>
          <CardDescription>退出登录或管理您的账户</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
