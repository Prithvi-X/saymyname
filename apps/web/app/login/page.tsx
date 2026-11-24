'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { ShieldIcon, LockIcon } from '../../components/icons';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/discover';
  const { login } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.endsWith('iitm.ac.in')) {
      setError('SayMyName Phase 1 is restricted to verified IIT Madras non-campus BS students. Please enter your official @*.study.iitm.ac.in address.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.register({
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0],
        password: 'TemporaryPassword123!',
      });
      if (res.syntheticOtp) setDevOtpHint(res.syntheticOtp);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send login code. Please check your institutional email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.verifyOtp({ email: email.toLowerCase().trim(), otp: otp.trim() });
      if (res.accessToken) {
        const user = await login(res.accessToken, res.refreshToken);
        if (user?.eligibility?.discoveryEligible) {
          router.push(returnUrl);
        } else if (user?.eligibility?.ageStatus !== 'approved') {
          router.push('/onboarding');
        } else if (user?.eligibility?.studentStatus !== 'approved') {
          router.push('/onboarding');
        } else {
          router.push('/discover');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '48px auto', padding: '0 20px' }}>
      <div className="card-surface" style={{ padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-brand-primary-subtle)',
              color: 'var(--color-brand-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
            }}
          >
            <LockIcon size={22} color="var(--color-brand-primary)" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '26px',
              fontWeight: 600,
              margin: '0 0 6px 0',
              color: 'var(--color-text-primary)',
            }}
          >
            Member Sign In
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '20px' }}>
            Enter your official IIT Madras institutional email to receive a secure login code.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(165, 47, 65, 0.08)',
              border: '1px solid var(--color-status-danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-danger)',
              fontSize: '13px',
              marginBottom: '20px',
              lineHeight: '18px',
            }}
          >
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label
                htmlFor="loginEmail"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Institutional Student Email
              </label>
              <input
                id="loginEmail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="username@study.iitm.ac.in"
                className="input-field"
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                Must be an active @*.study.iitm.ac.in domain address.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '14.5px' }}
            >
              {loading ? 'Sending Verification Code...' : 'Send Login Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label
                htmlFor="loginOtp"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                }}
              >
                6-Digit Verification Code
              </label>
              <input
                id="loginOtp"
                type="text"
                required
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="input-field"
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '20px', fontWeight: 600 }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                Sent to <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>.
              </span>
            </div>

            {devOtpHint && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-brand-primary-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-brand-primary)',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                Development Test OTP: <strong>{devOtpHint}</strong>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '14.5px' }}
            >
              {loading ? 'Verifying Session...' : 'Verify & Enter'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError(null);
              }}
              style={{
                fontSize: '12.5px',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              ← Use a different institutional email
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--color-border-subtle)',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>New student? </span>
          <Link
            href="/onboarding"
            style={{ color: 'var(--color-brand-primary)', fontWeight: 600, textDecoration: 'underline' }}
          >
            Register here
          </Link>
        </div>
      </div>

      <div
        style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '11.5px',
          color: 'var(--color-text-muted)',
          lineHeight: '17px',
        }}
      >
        <ShieldIcon size={13} color="var(--color-text-muted)" style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
        SayMyName is an independent platform for verified adult BS students. Not operated by or affiliated with IIT Madras.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
