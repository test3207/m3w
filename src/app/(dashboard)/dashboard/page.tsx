import { auth, signOut } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const userInitials = session.user.name
    ? session.user.name.split(" ").map(n => n[0]).join("").toUpperCase()
    : session.user.email?.[0].toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">
                M3W Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  Welcome back, {session.user.name?.split(" ")[0] || "there"}! 👋
                </CardTitle>
                <CardDescription className="mt-2">
                  Your Next.js full-stack application is ready. Start building amazing features!
                </CardDescription>
              </div>
              <Badge variant="secondary" className="hidden sm:block">
                Production Ready
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Tech Stack Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                Next.js 15
              </CardTitle>
              <CardDescription>
                App Router with Server Components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Server-side rendering, static generation, and the latest React features.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge>SSR</Badge>
                <Badge>SSG</Badge>
                <Badge>RSC</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                NextAuth.js v5
              </CardTitle>
              <CardDescription>
                Secure GitHub OAuth authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Production-ready authentication with database sessions.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge variant="secondary">GitHub OAuth</Badge>
                <Badge variant="secondary">Sessions</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🗄️</span>
                Prisma ORM
              </CardTitle>
              <CardDescription>
                Type-safe database access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                PostgreSQL with auto-generated TypeScript types and migrations.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge variant="outline">PostgreSQL 16</Badge>
                <Badge variant="outline">Type-safe</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                shadcn/ui
              </CardTitle>
              <CardDescription>
                Beautiful, accessible components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Radix UI primitives styled with Tailwind CSS. Fully customizable.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge variant="secondary">Tailwind v4</Badge>
                <Badge variant="secondary">Accessible</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🐳</span>
                Container Ready
              </CardTitle>
              <CardDescription>
                Podman & Docker support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Production containers with PostgreSQL and Redis. K8s ready.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge variant="outline">Podman</Badge>
                <Badge variant="outline">K8s</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                Production Grade
              </CardTitle>
              <CardDescription>
                Enterprise-ready architecture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                TypeScript strict mode, ESLint, logging, and best practices.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge>TypeScript</Badge>
                <Badge>ESLint 9</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to help you get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button>View Profile</Button>
              <Button variant="outline">Settings</Button>
              <Button variant="secondary">Documentation</Button>
              <Button variant="ghost">API Reference</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
