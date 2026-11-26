'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { isApprovedIitmBsEmail, normalizeInstitutionalEmail } from '@saymyname/validation';
import { api } from '../../lib/api';
import { Button, Input } from '../../components/ui';
import { ThresholdMark } from '../../components/brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittedMsg(null);
    setDevResetToken(null);

    const clean = normalizeInstitutionalEmail(email);
    if (!isApprovedIitmBsEmail(clean)) {
      setError('Enter your approved @*.study.iitm.ac.in institutional email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.forgotPassword(clean);
      setSubmittedMsg(res.message);
      if (res.devResetToken) {
        setDevResetToken(res.devResetToken);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to process recovery request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-void flex items-center py-10 sm:py-14 font-ui">
      <div className="container-app grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <section className="lg:col-span-5 flex flex-col gap-5 min-w-0">
          <div className="inline-flex items-center p-3 rounded-[10px] border border-edge bg-coal self-start">
            <ThresholdMark variant="aligned" size="sm" />
          </div>
          <p className="text-[13px] font-medium text-iris">Account recovery</p>
          <h1 className="text-[2rem] sm:text-[2.25rem] font-semibold text-chalk tracking-[-0.02em] leading-[1.1]">
            Reset or set your password
          </h1>
          <p className="text-sm sm:text-base text-silver leading-relaxed max-w-md">
            Enter your approved IIT Madras BS study email. Single-use links expire in 30 minutes and sign out previous browser sessions cleanly.
          </p>
        </section>

        <section className="lg:col-span-7 w-full flex lg:justify-end">
          <div className="w-full max-w-[540px] bg-coal border border-edge rounded-[12px] p-6 sm:p-9 lg:p-10">
            <h2 className="text-2xl font-semibold text-chalk mb-2">Recovery Request</h2>
            <p className="text-sm text-silver mb-6 leading-relaxed">
              We will never reveal whether an email is registered on screen.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-[6px] bg-danger-subtle border border-danger/40 text-sm text-danger"
              >
                {error}
              </div>
            )}

            {submittedMsg && (
              <div className="mb-5 p-4 rounded-[6px] bg-success-subtle border border-success/40 text-sm text-chalk space-y-2 leading-relaxed">
                <p>{submittedMsg}</p>
                {devResetToken && (
                  <div className="pt-2 border-t border-success/30">
                    <p className="text-silver mb-1">Local non-production recovery link:</p>
                    <Link
                      href={`/reset-password?token=${encodeURIComponent(devResetToken)}`}
                      className="text-iris font-mono underline break-all"
                    >
                      Open Password Reset Page →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <Input
                label="Institutional BS Email"
                id="forgot-email"
                type="email"
                required
                placeholder="name@study.iitm.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
                Send Recovery Instructions
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-edge flex items-center justify-between text-sm text-silver">
              <span>Remembered your password?</span>
              <Link href="/login" className="text-iris hover:text-iris-hover font-semibold">
                Back to Sign In
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
