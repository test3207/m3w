'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/lib/logger-client';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    
    if (success === 'true') {
      // Backend has set HTTP-only cookies with tokens
      // Now fetch user info (cookies will be sent automatically)
      const fetchUserInfo = async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/me`,
            {
              credentials: 'include', // Send cookies
            }
          );

          const data = await response.json();

          if (response.ok && data.success && data.data) {
            // Extract tokens from response headers or use a separate endpoint
            // For now, we need to get tokens to store in frontend
            // Let's call a new endpoint that returns tokens (non-HttpOnly)
            const tokenResponse = await fetch(
              `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/session`,
              {
                credentials: 'include',
              }
            );
            
            const tokenData = await tokenResponse.json();
            
            if (tokenResponse.ok && tokenData.success && tokenData.data) {
              setAuth(data.data, {
                accessToken: tokenData.data.accessToken,
                refreshToken: tokenData.data.refreshToken,
                expiresAt: tokenData.data.expiresAt,
              });
              navigate('/now-playing');
            } else {
              logger.error('Failed to get session', { tokenData });
              navigate('/signin?error=session_failed');
            }
          } else {
            logger.error('Auth failed', { data });
            navigate('/signin?error=auth_failed');
          }
        } catch (error) {
          logger.error('Fetch user error', { error });
          navigate('/signin?error=auth_failed');
        }
      };

      fetchUserInfo();
    } else {
      // Error in auth callback
      navigate('/signin?error=auth_failed');
    }
  }, [navigate, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 animate-spin">⏳</div>
        <p>Authenticating...</p>
      </div>
    </div>
  );
}
