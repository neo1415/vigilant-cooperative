'use client';

/**
 * Forgot Password Page
 * 
 * Allows users to request a password reset OTP.
 * 
 * Features:
 * - Phone number input
 * - OTP sent confirmation
 * - Redirect to reset password page
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setLoading(false);
        return;
      }

      setSuccess(true);
      
      // Redirect to reset password page after 2 seconds
      setTimeout(() => {
        router.push(`/reset-password?identifier=${encodeURIComponent(identifier)}`);
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
            OTP Sent!
          </h1>
          
          <p className="text-[var(--text-secondary)] mb-6">
            If an account exists with that identifier, an OTP has been sent to your phone.
            Redirecting to reset password page...
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
            Forgot Password?
          </h1>
          <p className="text-[var(--text-secondary)]">
            Enter your Member ID or phone number to receive a password reset OTP
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
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
