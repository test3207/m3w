import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="mb-4" variant="secondary">
            Next.js 15 • TypeScript • Tailwind CSS
          </Badge>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            M3W
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-8">
            Production-Grade Full-Stack Web Application
          </p>
          <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
            Built with Next.js 15, NextAuth.js, Prisma, and shadcn/ui.
            Self-hosted ready with Podman/Docker and Kubernetes support.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/api/auth/signin">Sign In with GitHub</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                Modern Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Next.js 15 with App Router, React Server Components, and
                TypeScript strict mode.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                Secure Auth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                NextAuth.js v5 with GitHub OAuth, database sessions, and CSRF
                protection.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">💾</span>
                Type-Safe DB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Prisma ORM with PostgreSQL 16, auto-generated types, and
                migrations.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                Beautiful UI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                shadcn/ui components with Radix UI primitives and Tailwind CSS
                v4.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🐳</span>
                Container Ready
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Podman/Docker support with GHCR images. Kubernetes deployment
                configs included.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🌐</span>
                China Friendly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                GHCR default images, proxy configuration guides, and
                cross-platform setup scripts.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-6">Technology Stack</h2>
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
            <Badge variant="secondary">Next.js 15</Badge>
            <Badge variant="secondary">React 18</Badge>
            <Badge variant="secondary">TypeScript 5</Badge>
            <Badge variant="secondary">Tailwind CSS v4</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
            <Badge variant="secondary">NextAuth.js v5</Badge>
            <Badge variant="secondary">Prisma</Badge>
            <Badge variant="secondary">PostgreSQL 16</Badge>
            <Badge variant="secondary">Redis 7</Badge>
            <Badge variant="secondary">Podman</Badge>
            <Badge variant="secondary">Kubernetes</Badge>
            <Badge variant="secondary">ESLint 9</Badge>
            <Badge variant="secondary">Pino</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
