'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { isApprovedIitmBsEmail, normalizeInstitutionalEmail } from '@saymyname/validation';
import { api } from '../../lib/api';
import { Button, Input } from '../../components/ui';

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
    <div className="min-h-[calc(100vh-140px)] bg-void smn-ambient-calm smn-stage-wrap flex flex-col items-center justify-center px-4 py-12 font-ui">
      <div className="w-full max-w-[440px] bg-coal border border-edge rounded-[12px] p-7 sm:p-9 smn-surface-elevated">
        <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-1.5">
          Account Recovery
        </p>
        <h1 className="text-2xl font-semibold text-chalk mb-2">Reset or Set Password</h1>
        <p className="text-xs sm:text-sm text-silver mb-6 leading-relaxed">
          Enter your IIT Madras BS study email. If an account exists, we will send a single-use
          link expiring in 30 minutes. Resetting your password signs out older sessions.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-[6px] bg-danger-subtle border border-danger/40 text-xs text-danger"
          >
            {error}
          </div>
        )}

        {submittedMsg && (
          <div className="mb-5 p-4 rounded-[6px] bg-success-subtle border border-success/40 text-xs text-chalk space-y-2 leading-relaxed">
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Institutional BS Email"
            id="forgot-email"
            type="email"
            required
            placeholder="name@study.iitm.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full">
            Send Recovery Instructions
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-edge text-center text-xs text-silver">
          Remembered your password?{' '}
          <Link href="/login" className="text-iris hover:text-iris-hover font-semibold">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
