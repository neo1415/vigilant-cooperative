'use client';

/**
 * Reset Password Page
 * 
 * Allows users to reset their password using an OTP.
 * 
 * Features:
 * - OTP input
 * - New password input with strength indicator
 * - Countdown timer for OTP expiry
 * - Resend OTP functionality
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifierFromQuery = searchParams.get('identifier') || '';

  const [identifier, setIdentifier] = useState(identifierFromQuery);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const passwordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score === 3) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = passwordStrength(newPassword);

  const handleResendOtp = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error.message);
      } else {
        setCountdown(600); // Reset countdown
        alert('OTP resent successfully');
      }
    } catch (err) {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          otp,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-surface)] p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Password Reset Successful!
          </h1>
          
          <p className="text-[var(--text-secondary)] mb-6">
            Your password has been reset. Redirecting to login...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-surface)] p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Reset Password
          </h1>
          <p className="text-[var(--text-secondary)]">
            Enter the OTP sent to your phone and create a new password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!identifierFromQuery && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Member ID or Phone Number
              </label>
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="VIG-2026-001 or +234..."
                required
                disabled={loading}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                OTP Code
              </label>
              <span className="text-sm text-[var(--text-muted)]">
                {countdown > 0 ? `Expires in ${formatTime(countdown)}` : 'Expired'}
              </span>
            </div>
            <Input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
              disabled={loading}
              className="text-center text-2xl tracking-widest font-mono"
            />
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading || countdown > 0}
              className="text-sm text-[var(--accent-primary)] hover:underline mt-2 disabled:opacity-50"
            >
              Resend OTP
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              New Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all`}
                      style={{ width: `${(strength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Confirm Password
            </label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || countdown === 0}
            className="w-full"
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-[var(--accent-primary)] hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
