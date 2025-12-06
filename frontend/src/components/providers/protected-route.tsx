import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { I18n } from "@/locales/i18n";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground" suppressHydrationWarning>
              {I18n.common.loadingLabel}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to sign-in page, preserving the intended destination
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
