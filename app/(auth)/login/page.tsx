'use client';

/**
 * Login Page
 * 
 * Allows members to log in with their Member ID or phone number and password.
 * Supports MFA (TOTP) for users with MFA enabled.
 * 
 * Features:
 * - Member ID or phone number input
 * - Password input with show/hide toggle
 * - Remember me checkbox
 * - Forgot password link
 * - MFA code input (conditional)
 * - Error handling and validation
 * - Redirect to dashboard on success
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
          ...(mfaRequired && { totpCode }),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.error.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          setError('Please enter your MFA code');
        } else {
          setError(data.error.message);
        }
        setLoading(false);
        return;
      }

      // Store access token
      if (rememberMe) {
        localStorage.setItem('accessToken', data.data.accessToken);
      } else {
        sessionStorage.setItem('accessToken', data.data.accessToken);
      }

      // Store user info
      localStorage.setItem('user', JSON.stringify(data.data.user));

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-surface)] p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Welcome Back
          </h1>
          <p className="text-[var(--text-secondary)]">
            Sign in to your Vigilant Cooperative account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identifier Input */}
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              Member ID or Phone Number
            </label>
            <Input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="VIG-2026-001 or +234..."
              required
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* MFA Code Input (conditional) */}
          {mfaRequired && (
            <div>
              <label
                htmlFor="totpCode"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                MFA Code
              </label>
              <Input
                id="totpCode"
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                disabled={loading}
                className="w-full text-center text-2xl tracking-widest font-mono"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          )}

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-[var(--accent-primary)] border-[var(--text-muted)] rounded focus:ring-[var(--accent-primary)]"
              />
              <span className="ml-2 text-sm text-[var(--text-secondary)]">
                Remember me
              </span>
            </label>

            <Link
              href="/forgot-password"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Don't have an account?{' '}
            <Link
              href="/register"
              className="text-[var(--accent-primary)] hover:underline font-medium"
            >
              Register here
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
