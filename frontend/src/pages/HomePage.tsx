import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Music } from "lucide-react";
import { I18n } from "@/locales/i18n";
import { LanguageSwitcher } from "@/components/layouts/language-switcher";
import { useAuthStore } from "@/stores/authStore";

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/libraries" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              M3W
            </div>
            <span className="text-lg font-semibold" suppressHydrationWarning>
              {I18n.app.name}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 items-center justify-center">
        <div className="container px-4">
          <div className="mx-auto max-w-lg text-center">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Music className="h-12 w-12 text-primary" />
              </div>
            </div>

            {/* Title */}
            <h1
              className="mb-3 text-3xl font-bold tracking-tight"
              suppressHydrationWarning
            >
              {I18n.home.title}
            </h1>

            {/* Description */}
            <p className="mb-8 text-muted-foreground" suppressHydrationWarning>
              {I18n.home.description}
            </p>

            {/* CTA */}
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/signin" suppressHydrationWarning>
                {I18n.home.getStarted}
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p className="mb-1" suppressHydrationWarning>
            {I18n.home.footer.tagline}
          </p>
          <a
            href="https://github.com/test3207/m3w"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            github.com/test3207/m3w
          </a>
        </div>
      </footer>
    </div>
  );
}
