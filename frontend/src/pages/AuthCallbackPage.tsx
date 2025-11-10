'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // Extract tokens from URL params
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      // Calculate expiry (tokens are valid for 15 minutes by default)
      const expiresAt = Date.now() + 15 * 60 * 1000;

      // Fetch user info
      fetch('http://localhost:4000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setAuth(data.data, {
              accessToken,
              refreshToken,
              expiresAt,
            });
            navigate('/dashboard');
          } else {
            navigate('/signin?error=auth_failed');
          }
        })
        .catch(() => {
          navigate('/signin?error=auth_failed');
        });
    } else {
      navigate('/signin?error=missing_tokens');
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
