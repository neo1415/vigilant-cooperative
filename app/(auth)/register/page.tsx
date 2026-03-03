'use client';

/**
 * Registration Page
 * 
 * Multi-step registration form for new members.
 * 
 * Steps:
 * 1. Employee ID, full name, phone, email
 * 2. Department, salary reference, date joined
 * 3. Password creation with strength indicator
 * 
 * Features:
 * - Multi-step form with progress indicator
 * - Form validation
 * - Password strength indicator
 * - Success message with "awaiting approval" notice
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [memberId, setMemberId] = useState('');

  // Step 1 fields
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 fields
  const [department, setDepartment] = useState('');
  const [dateJoined, setDateJoined] = useState('');

  // Step 3 fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const strength = passwordStrength(password);

  const handleNext = () => {
    setError('');
    
    if (step === 1) {
      if (!employeeId || !fullName || !phone) {
        setError('Please fill in all required fields');
        return;
      }
      if (!/^\+234[0-9]{10}$/.test(phone)) {
        setError('Phone number must be in format +234XXXXXXXXXX');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!department || !dateJoined) {
        setError('Please fill in all required fields');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          employeeId,
          phone,
          email: email || undefined,
          department,
          dateJoined,
          password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error.message);
        setLoading(false);
        return;
      }

      setMemberId(data.data.memberId);
      setSuccess(true);
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
            Registration Successful!
          </h1>
          
          <p className="text-[var(--text-secondary)] mb-4">
            Your Member ID is:
          </p>
          
          <div className="bg-[var(--bg-surface)] p-4 rounded-lg mb-6">
            <p className="text-2xl font-mono font-bold text-[var(--accent-primary)]">
              {memberId}
            </p>
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your account is awaiting approval from the cooperative officers.
              You will receive an SMS notification once approved.
            </p>
          </div>
          
          <Button
            onClick={() => router.push('/login')}
            className="w-full"
          >
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-surface)] p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Join Vigilant Cooperative
          </h1>
          <p className="text-[var(--text-secondary)]">
            Register your account to get started
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s === step
                    ? 'bg-[var(--accent-primary)] text-white'
                    : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 ${
                    s < step ? 'bg-green-500' : 'bg-[var(--bg-surface)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Employee ID *
                </label>
                <Input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Your employee ID"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Full Name *
                </label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Phone Number *
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234XXXXXXXXXX"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Email (Optional)
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* Step 2: Employment Information */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Department *
                </label>
                <Input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., IT, Finance, Operations"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Date Joined *
                </label>
                <Input
                  type="date"
                  value={dateJoined}
                  onChange={(e) => setDateJoined(e.target.value)}
                  required
                  disabled={loading}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Password *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                
                {password && (
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
                    <p className="text-xs text-[var(--text-muted)]">
                      Must be at least 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Confirm Password *
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
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            {step > 1 && (
              <Button
                type="button"
                onClick={handleBack}
                disabled={loading}
                variant="secondary"
                className="flex-1"
              >
                Back
              </Button>
            )}
            
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1"
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Registering...' : 'Register'}
              </Button>
            )}
          </div>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[var(--accent-primary)] hover:underline font-medium"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
