import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { logger } from "@/lib/logger-client";
import { getApiBaseUrl } from "@/lib/api/config";
import {
  isMultiRegionEnabled,
  findAvailableEndpoint,
} from "@/lib/api/multi-region";
import { I18n } from "@/locales/i18n";

/**
 * Authentication Callback Page
 * 
 * Handles two authentication flows:
 * 
 * 1. Cookie-based flow (local dev / AIO / normal multi-region):
 *    - Backend redirects here with `?success=true`
 *    - HTTP-only cookies already set by backend
 *    - Page fetches user info via /api/auth/me and /api/auth/session
 * 
 * 2. Fallback flow (Gateway backend down, frontend still reachable):
 *    - Requires: CF Pages frontend is deployed separately from Gateway backend
 *    - GitHub redirects here with `?code=xxx`
 *    - Page finds available regional backend (4th-level domain)
 *    - Redirects to backend's /api/auth/callback with code
 *    - Backend handles everything, redirects back with ?success=true
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const hasRun = useRef(false);
  const [status, setStatus] = useState(I18n.signin.status.authenticating);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const code = params.get("code");

    if (success === "true") {
      // Flow 1: Backend already processed auth, cookies are set
      handleCookieFlow();
    } else if (code) {
      // Flow 2: GitHub redirected here with code (Gateway backend down, frontend still reachable)
      // Use consistent error code pattern: auth_failed for authentication errors
      handleCodeRedirectFlow(code).catch((error) => {
        logger.error("Auth code redirect flow failed", { error });
        navigate("/signin?error=auth_failed");
      });
    } else {
      // No valid auth parameters - use auth_failed for consistency
      navigate("/signin?error=auth_failed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps array - only run once on mount

  /**
   * Flow 1: Cookie-based authentication
   * Backend has already processed OAuth and set HTTP-only cookies
   */
  function handleCookieFlow() {
    // Cookies are already set by the redirect response, fetch user info immediately
    fetchUserInfoFromCookies();
  }

  async function fetchUserInfoFromCookies() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        credentials: "include", // Send cookies
      });

      const data = await response.json();

      if (response.ok && data.success && data.data) {
        // Get tokens to store in frontend
        const tokenResponse = await fetch(
          `${getApiBaseUrl()}/api/auth/session`,
          {
            credentials: "include",
          }
        );

        const tokenData = await tokenResponse.json();

        if (tokenResponse.ok && tokenData.success && tokenData.data) {
          setAuth(data.data, {
            accessToken: tokenData.data.accessToken,
            refreshToken: tokenData.data.refreshToken,
            expiresAt: tokenData.data.expiresAt,
          });
          navigate("/libraries");
        } else {
          logger.error("Failed to get session", { tokenData });
          navigate("/signin?error=session_failed");
        }
      } else {
        logger.error("Auth failed", { data });
        navigate("/signin?error=auth_failed");
      }
    } catch (error) {
      logger.error("Fetch user error", { error });
      navigate("/signin?error=auth_failed");
    }
  }

  /**
   * Flow 2: Fallback - GitHub redirected here with code
   * This happens when CF/Gateway is down but CF Pages still serves frontend.
   * We find an available backend and redirect to its /api/auth/callback
   */
  async function handleCodeRedirectFlow(code: string) {
    // Check if multi-region is configured
    if (!isMultiRegionEnabled()) {
      // Not multi-region mode, redirect to local backend's callback
      const backendUrl = `${getApiBaseUrl()}/api/auth/callback?code=${encodeURIComponent(code)}`;
      setStatus(I18n.signin.status.redirecting);
      window.location.href = backendUrl;
      return;
    }

    // Find available backend endpoint (4th-level domain)
    setStatus(I18n.signin.status.findingServer);
    const endpoint = await findAvailableEndpoint();

    if (!endpoint) {
      // All regional endpoints unavailable
      // Show error instead of redirecting to potentially unavailable Gateway
      setStatus(I18n.signin.status.noServers);
      setTimeout(() => {
        navigate("/signin?error=no_servers");
      }, 2000);
      return;
    }

    // Redirect to available backend's callback endpoint
    setStatus(I18n.signin.status.connecting);
    const backendUrl = `${endpoint}/api/auth/callback?code=${encodeURIComponent(code)}`;
    window.location.href = backendUrl;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 animate-spin">⏳</div>
        <p>{status}</p>
      </div>
    </div>
  );
}
