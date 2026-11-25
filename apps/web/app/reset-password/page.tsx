'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { Button, Input } from '../../components/ui';

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
    <div className="min-h-[calc(100vh-140px)] bg-void smn-ambient-calm smn-stage-wrap flex flex-col items-center justify-center px-4 py-12 font-ui">
      <div className="w-full max-w-[440px] bg-coal border border-edge rounded-[12px] p-7 sm:p-9 smn-surface-elevated">
        <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-1.5">
          Credential Update
        </p>
        <h1 className="text-2xl font-semibold text-chalk mb-2">Choose a New Password</h1>
        <p className="text-xs sm:text-sm text-silver mb-6">
          Minimum 8 characters. Completing this step automatically revokes all previous sessions.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-[6px] bg-danger-subtle border border-danger/40 text-xs text-danger"
          >
            {error}
          </div>
        )}

        {successMsg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-[6px] bg-success-subtle border border-success/40 text-xs text-chalk leading-relaxed">
              {successMsg}
            </div>
            <Link href="/login" className="block">
              <Button variant="primary" size="md" className="w-full">
                Proceed to Sign In →
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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

            <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full">
              Update Password
            </Button>
          </form>
        )}
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
