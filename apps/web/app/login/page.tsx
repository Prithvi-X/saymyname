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
import { ThresholdMark } from '../../components/brand';
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
    <div className="min-h-[calc(100vh-140px)] bg-void flex items-center py-10 sm:py-14 font-ui">
      <div className="container-app grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left Region: Editorial Identity & Cohort Context (5 Cols Desktop) */}
        <section className="lg:col-span-5 flex flex-col gap-5 min-w-0">
          <div className="inline-flex items-center gap-3 self-start p-3 rounded-[10px] border border-edge bg-coal">
            <ThresholdMark variant="aligned" size="sm" />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-medium text-iris">
              Phase 1 · Verified IIT Madras non-campus BS adults (18+)
            </p>
            <h1 className="text-[2rem] sm:text-[2.5rem] font-semibold text-chalk tracking-[-0.025em] leading-[1.08]">
              Two identities. One quiet interval.
            </h1>
            <p className="text-sm sm:text-base text-silver leading-relaxed max-w-md">
              Sign in to review reciprocal matches, respond to private mutual conversations, or resume your student enrolment verification.
            </p>
          </div>

          <div className="pt-4 border-t border-edge flex flex-col gap-2 text-[13px] text-silver max-w-md">
            <div className="flex items-center gap-2 text-chalk font-medium">
              <LockIcon size={15} color="#8580C4" />
              <span>Private by default · Mutual match required before messaging</span>
            </div>
            <p className="text-xs text-silver/80 leading-relaxed">
              Independent platform for adult learners enrolled in the four approved IIT Madras non-campus BS tracks. Not owned, endorsed, or operated by IIT Madras.
            </p>
          </div>
        </section>

        {/* Right Region: Sign-In Surface (7 Cols Desktop) */}
        <section className="lg:col-span-7 w-full flex lg:justify-end">
          <div className="w-full max-w-[540px] bg-coal border border-edge rounded-[12px] p-6 sm:p-9 lg:p-10">
            <div className="mb-7">
              <h2 className="text-2xl font-semibold text-chalk tracking-[-0.015em] mb-1.5">
                Member Sign In
              </h2>
              <p className="text-sm text-silver">
                Use your approved IIT Madras BS study email and password.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 p-4 rounded-[8px] bg-danger-subtle border border-danger/40 text-sm text-danger leading-relaxed"
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <Input
                label="Institutional BS Email"
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@study.iitm.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Accepts @study.iitm.ac.in, @ds.study.iitm.ac.in, or @es.study.iitm.ac.in."
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
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="text-xs font-medium text-silver hover:text-chalk px-2 py-1.5 rounded-[4px] focus-visible:outline-2 focus-visible:outline-iris"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                }
              />

              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-iris hover:text-iris-hover font-medium transition-colors py-1"
                >
                  Forgot or need to set password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
              >
                Sign In
              </Button>
            </form>

            <div className="mt-7 pt-5 border-t border-edge flex flex-wrap items-center justify-between gap-2 text-sm text-silver">
              <span>New to SayMyName?</span>
              <Link
                href={appendSafeReturnUrl('/onboarding', rawReturn)}
                className="text-iris hover:text-iris-hover font-semibold"
              >
                Create your account →
              </Link>
            </div>
          </div>
        </section>
      </div>
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
