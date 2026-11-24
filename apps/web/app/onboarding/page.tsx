'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import {
  CheckIcon,
  ShieldIcon,
  LockIcon,
  BookOpenIcon,
  CompassIcon,
} from '../../components/icons';

const PROGRAMME_OPTIONS = [
  { value: 'data_science_applications', label: 'BS in Data Science and Applications' },
  { value: 'electronic_systems', label: 'BS in Electronic Systems' },
  { value: 'aeronautics_space', label: 'BS in Aeronautics and Space Technology' },
  { value: 'management_data_science', label: 'BS in Management and Data Science' },
];

export default function OnboardingPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [programmeFamily, setProgrammeFamily] = useState(PROGRAMME_OPTIONS[0].value);
  const [studentRollNo, setStudentRollNo] = useState('');

  // Step 1: Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({ email, displayName, password });
      if (res.syntheticOtp) setDevOtpHint(res.syntheticOtp);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOtp({ email: email.toLowerCase().trim(), otp: otp.trim() });
      if (res.accessToken) {
        await login(res.accessToken, res.refreshToken);
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: 18+ Age Check
  const handleAgeCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyAge({ dateOfBirth });
      if (!res.isAdult) {
        setError('Under-18 accounts are strictly barred from SayMyName under Phase 1 safety policy.');
        return;
      }
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Age verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify Student Enrolment
  const handleVerifyStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyStudent({ programmeFamily, studentRollNo: studentRollNo.trim() });
      if (res.accessToken) {
        await login(res.accessToken);
      }
      setStep(5);
    } catch (err: any) {
      setError(err.message || 'Student verification failed');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Account', 'Email OTP', '18+ Age Gate', 'BS Track', 'Verified'];

  return (
    <div style={{ maxWidth: '520px', margin: '36px auto', padding: '0 20px 60px 20px' }}>
      {/* Progress Stepper */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < step;
            const isCurrent = stepNum === step;
            return (
              <span
                key={label}
                style={{
                  fontSize: '11px',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--color-brand-primary)' : isCompleted ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </span>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: s <= step ? 'var(--color-brand-primary)' : 'var(--color-border-default)',
                transition: 'background-color var(--duration-normal) var(--ease-out)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="card-editorial" style={{ padding: '36px' }}>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(165, 47, 65, 0.08)',
              border: '1px solid rgba(165, 47, 65, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-danger)',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        {/* STEP 1: Registration */}
        {step === 1 && (
          <form onSubmit={handleRegister}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, marginBottom: '8px' }}>
              Create Your Account
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px', lineHeight: '22px' }}>
              SayMyName Phase 1 is exclusive to verified adult learners in the four approved IIT Madras BS programme families.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label className="label-editorial" htmlFor="onboardingEmail">Institutional Student Email</label>
              <input
                id="onboardingEmail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="username@study.iitm.ac.in"
                className="input-editorial"
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                Must be an official @study.iitm.ac.in domain address.
              </span>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="label-editorial" htmlFor="onboardingName">Display Name (First Name)</label>
              <input
                id="onboardingName"
                type="text"
                required
                autoComplete="given-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your preferred first name"
                className="input-editorial"
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label className="label-editorial" htmlFor="onboardingPassword">Password</label>
              <input
                id="onboardingPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a secure password (min 8 characters)"
                className="input-editorial"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
            >
              {loading ? 'Submitting...' : 'Continue to Verification'}
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              <span>Already registered? </span>
              <Link href="/login" style={{ color: 'var(--color-brand-primary)', fontWeight: 600, textDecoration: 'underline' }}>
                Sign in here
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: Email OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, marginBottom: '8px' }}>
              Verify Your Email
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '20px', lineHeight: '22px' }}>
              We sent a 6-digit verification code to <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>.
            </p>

            {devOtpHint && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-brand-primary-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-brand-primary)',
                  fontSize: '13px',
                  marginBottom: '20px',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                Development Test OTP: <span style={{ letterSpacing: '2px' }}>{devOtpHint}</span>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label className="label-editorial">6-Digit Verification Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="input-editorial"
                style={{ fontSize: '20px', letterSpacing: '6px', textAlign: 'center' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        )}

        {/* STEP 3: 18+ Age Gate */}
        {step === 3 && (
          <form onSubmit={handleAgeCheck}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--color-surface-subtle)', marginBottom: '16px' }}>
              <ShieldIcon size={24} color="var(--color-brand-primary)" />
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, marginBottom: '8px' }}>
              18+ Adult Assurance
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '20px', lineHeight: '22px' }}>
              SayMyName strictly complies with Indian DPDP Act adult boundaries. You must be at least 18 years old. Your date of birth is kept private and never shown publicly.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label className="label-editorial">Date of Birth</label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="input-editorial"
              />
            </div>

            <div className="callout-trust" style={{ marginBottom: '24px' }}>
              <LockIcon size={16} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Privacy Invariant</strong>: DOB is only used to compute your age number (e.g. 21). Your exact birthdate is encrypted and never shared.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
            >
              {loading ? 'Checking...' : 'Confirm Adult Eligibility'}
            </button>
          </form>
        )}

        {/* STEP 4: IITM Programme Verification */}
        {step === 4 && (
          <form onSubmit={handleVerifyStudent}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--color-surface-subtle)', marginBottom: '16px' }}>
              <BookOpenIcon size={24} color="var(--color-brand-primary)" />
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, marginBottom: '8px' }}>
              Student Enrolment
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '20px', lineHeight: '22px' }}>
              Select your active IIT Madras non-campus BS programme family.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label className="label-editorial">Approved Programme Family</label>
              <select
                value={programmeFamily}
                onChange={(e) => setProgrammeFamily(e.target.value)}
                className="input-editorial"
                style={{ cursor: 'pointer' }}
              >
                {PROGRAMME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label className="label-editorial">Student Roll Number</label>
              <input
                id="onboardingRollNo"
                type="text"
                required
                autoComplete="off"
                value={studentRollNo}
                onChange={(e) => setStudentRollNo(e.target.value)}
                placeholder="e.g. 21F1000001"
                className="input-editorial"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
            >
              {loading ? 'Verifying Enrolment...' : 'Complete Enrolment Verification'}
            </button>
          </form>
        )}

        {/* STEP 5: Verification Approved */}
        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'rgba(40, 107, 85, 0.12)',
                color: 'var(--color-status-success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <CheckIcon size={36} color="var(--color-status-success)" strokeWidth={2.5} />
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, marginBottom: '10px' }}>
              Eligibility Verified!
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '28px' }}>
              Your 18+ adult age and IIT Madras non-campus BS enrolment have been confirmed. You are now authorized to complete your profile and enter dating discovery.
            </p>

            <Link
              href="/discover"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              <CompassIcon size={18} color="#FFFFFF" />
              <span>Enter Dating Discovery</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
