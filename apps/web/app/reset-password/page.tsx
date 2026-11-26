'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { Button, Input } from '../../components/ui';
import { ThresholdMark } from '../../components/brand';

function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('A valid password reset token is required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.resetPassword(token.trim(), newPassword);
      setSuccessMsg(res.message);
    } catch (err: any) {
      setError(err.message || 'Password reset link is invalid or expired.');
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
          <p className="text-[13px] font-medium text-iris">Credential update</p>
          <h1 className="text-[2rem] sm:text-[2.25rem] font-semibold text-chalk tracking-[-0.02em] leading-[1.1]">
            Choose a new password
          </h1>
          <p className="text-sm sm:text-base text-silver leading-relaxed max-w-md">
            Use at least 8 characters. Completing this update revokes all previous browser sessions cleanly.
          </p>
        </section>

        <section className="lg:col-span-7 w-full flex lg:justify-end">
          <div className="w-full max-w-[540px] bg-coal border border-edge rounded-[12px] p-6 sm:p-9 lg:p-10">
            <h2 className="text-2xl font-semibold text-chalk mb-2">New Passphrase</h2>
            <p className="text-sm text-silver mb-6">
              Set a unique passphrase for your verified account.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-[6px] bg-danger-subtle border border-danger/40 text-sm text-danger"
              >
                {error}
              </div>
            )}

            {successMsg ? (
              <div className="space-y-4">
                <div className="p-4 rounded-[6px] bg-success-subtle border border-success/40 text-sm text-chalk leading-relaxed">
                  {successMsg}
                </div>
                <Link href="/login" className="block">
                  <Button variant="primary" size="lg" className="w-full">
                    Proceed to Sign In →
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                {!initialToken && (
                  <Input
                    label="Recovery Token"
                    id="reset-token"
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your recovery token"
                  />
                )}

                <Input
                  label="New Password"
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Use a unique passphrase of at least 8 characters."
                />

                <Input
                  label="Confirm New Password"
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
                  Update Password
                </Button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] bg-void flex items-center justify-center text-sm text-silver">
          Loading password recovery...
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  );
}
