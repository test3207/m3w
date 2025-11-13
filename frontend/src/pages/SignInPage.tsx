import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from 'lucide-react';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function SignInPage() {
  useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    try {
      // Redirect to backend GitHub OAuth endpoint (must be full URL)
      window.location.href = `${BACKEND_URL}/api/auth/github`;
    } catch (error) {
      toast({
        title: "Sign-in failed",
        description: error instanceof Error ? error.message : "Failed to initiate GitHub sign-in",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span suppressHydrationWarning>{I18n.signin.back}</span>
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold" suppressHydrationWarning>
              {I18n.signin.title}
            </CardTitle>
            <CardDescription className="text-base" suppressHydrationWarning>
              {I18n.signin.description}
            </CardDescription>
          </CardHeader>

          <CardContent>
          <Button 
            onClick={handleGitHubSignIn}
            disabled={isLoading}
            className="w-full" 
            size="lg"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                clipRule="evenodd"
              />
            </svg>
            <span suppressHydrationWarning>
              {isLoading ? I18n.signin.processing : I18n.signin.button}
            </span>
          </Button>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground" suppressHydrationWarning>
              {I18n.signin.terms}
            </p>
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
