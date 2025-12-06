import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { I18n } from "@/locales/i18n";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/playlists", { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-bold" suppressHydrationWarning>
          {I18n.common.notFoundLabel}
        </h1>
        <p className="mb-6 text-muted-foreground" suppressHydrationWarning>
          {I18n.error.pageNotFound}
        </p>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {I18n.common.redirecting} {countdown}s...
        </p>
      </div>
    </div>
  );
}
