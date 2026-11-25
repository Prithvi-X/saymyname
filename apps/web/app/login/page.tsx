'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { isApprovedIitmBsEmail, normalizeInstitutionalEmail } from '@saymyname/validation';
import { AccountLifecycleState } from '@saymyname/contracts';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { appendSafeReturnUrl, resolveSafeReturnUrl } from '../../lib/return-path';
import { Button, Input } from '../../components/ui';
import { LockIcon } from '../../components/icons';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const rawReturn = searchParams.get('returnUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailOtp, setNeedsEmailOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsEmailOtp(false);

    const cleanEmail = normalizeInstitutionalEmail(email);
    if (!isApprovedIitmBsEmail(cleanEmail)) {
      setError(
        'SayMyName Phase 1 accepts approved IIT Madras non-campus BS study addresses (@study.iitm.ac.in, @ds.study.iitm.ac.in, @es.study.iitm.ac.in) only.',
      );
      return;
    }

    if (!password) {
      setError('Enter your password to sign in.');
      return;
    }

    setIsLoading(true);
    try {
      await api.login({ email: cleanEmail, password });
      const user = await refreshUser();

      if (user?.lifecycleState === AccountLifecycleState.ACTIVE_MEMBER) {
        router.push(resolveSafeReturnUrl(rawReturn, '/discover'));
      } else {
        router.push(appendSafeReturnUrl('/onboarding', rawReturn));
      }
    } catch (err: any) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsEmailOtp(true);
      }
      setError(err.message || 'Sign-in failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-void flex flex-col items-center justify-center px-4 py-12 font-ui">
      <div className="w-full max-w-[440px] bg-coal border border-edge rounded-[12px] p-7 sm:p-9 shadow-md">
        <div className="text-center mb-7">
          <div className="w-11 h-11 rounded-[8px] bg-iron border border-edge text-iris inline-flex items-center justify-center mb-4">
            <LockIcon size={20} color="currentColor" />
          </div>
          <h1 className="text-2xl font-semibold text-chalk mb-1.5">Member Sign In</h1>
          <p className="text-xs sm:text-sm text-silver">
            Sign in with your verified IIT Madras BS study email and password.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-[6px] bg-danger-subtle border border-danger/40 text-xs text-danger leading-relaxed"
          >
            <p>{error}</p>
            {needsEmailOtp && (
              <Link
                href={appendSafeReturnUrl(
                  `/onboarding?stage=otp&email=${encodeURIComponent(normalizeInstitutionalEmail(email))}`,
                  rawReturn,
                )}
                className="inline-block mt-2 font-semibold text-chalk underline"
              >
                Verify institutional email code →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Institutional BS Email"
            id="login-email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@study.iitm.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            helperText="Use your IIT Madras BS study email (@study.iitm.ac.in, @ds.study.iitm.ac.in, or @es.study.iitm.ac.in)."
          />

          <Input
            label="Password"
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-[11px] font-medium text-silver hover:text-chalk px-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-iris hover:text-iris-hover font-medium transition-colors"
            >
              Forgot or need to set password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-1"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-7 pt-5 border-t border-edge text-center text-xs text-silver">
          New to SayMyName?{' '}
          <Link
            href={appendSafeReturnUrl('/onboarding', rawReturn)}
            className="text-iris hover:text-iris-hover font-semibold"
          >
            Create your account →
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-ash max-w-sm leading-relaxed">
        Independent platform for verified IIT Madras non-campus BS adults (18+). Not operated by
        or affiliated with IIT Madras.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] bg-void flex items-center justify-center text-sm text-silver">
          Loading sign-in form...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
