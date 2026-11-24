'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

const PROGRAMME_OPTIONS = [
  { value: 'data_science_applications', label: 'BS in Data Science and Applications' },
  { value: 'electronic_systems', label: 'BS in Electronic Systems' },
  { value: 'aeronautics_space', label: 'BS in Aeronautics and Space Technology' },
  { value: 'management_data_science', label: 'BS in Management and Data Science' },
];

export default function OnboardingPage() {
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
      if (res.devOtp) setDevOtpHint(res.devOtp);
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
      await api.verifyOtp({ email, otp });
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
      await api.verifyStudent({ programmeFamily, studentRollNo });
      setStep(5);
    } catch (err: any) {
      setError(err.message || 'Student verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px' }}>
      {/* Progress Indicators */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: '4px',
              margin: '0 4px',
              backgroundColor: s <= step ? 'var(--color-brand-primary)' : 'var(--color-border-default)',
              borderRadius: '2px',
              transition: 'background-color var(--duration-normal) var(--ease-out)',
            }}
          />
        ))}
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          padding: '36px',
          boxShadow: 'var(--elevation-2)',
        }}
      >
        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(165, 47, 65, 0.1)',
              border: '1px solid var(--color-status-danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-danger)',
              fontSize: '14px',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        {/* STEP 1: Registration */}
        {step === 1 && (
          <form onSubmit={handleRegister}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Create Your Account</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              SayMyName Phase 1 is exclusive to verified adult learners in the four approved IIT Madras BS programme families.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Institutional / Student Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rollno@study.iitm.ac.in"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '15px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Display Name (First Name preferred)
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Aanya"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '15px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '15px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Submitting...' : 'Continue to Verification'}
            </button>
          </form>
        )}

        {/* STEP 2: Email OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Verify Your Email</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              We sent a verification code to <strong>{email}</strong>.
            </p>

            {devOtpHint && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-brand-primary-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-brand-primary)',
                  fontSize: '13px',
                  marginBottom: '20px',
                  fontWeight: 600,
                }}
              >
                Development Test OTP: {devOtpHint}
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '18px',
                  letterSpacing: '4px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        )}

        {/* STEP 3: 18+ Age Gate */}
        {step === 3 && (
          <form onSubmit={handleAgeCheck}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>18+ Age Assurance</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              SayMyName strictly complies with Indian DPDP Act adult boundaries. You must be at least 18 years old. Your date of birth is kept private and never shown publicly.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Date of Birth
              </label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '15px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Checking...' : 'Confirm Adult Eligibility'}
            </button>
          </form>
        )}

        {/* STEP 4: IITM Programme Verification */}
        {step === 4 && (
          <form onSubmit={handleVerifyStudent}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Student Enrolment</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Select your active IIT Madras non-campus BS programme family.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Approved Programme Family
              </label>
              <select
                value={programmeFamily}
                onChange={(e) => setProgrammeFamily(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '14px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {PROGRAMME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Student Roll / Registration Number
              </label>
              <input
                type="text"
                required
                value={studentRollNo}
                onChange={(e) => setStudentRollNo(e.target.value)}
                placeholder="21f1000123"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '15px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Verifying Enrolment...' : 'Complete Enrolment Verification'}
            </button>
          </form>
        )}

        {/* STEP 5: Verification Approved */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(40, 107, 85, 0.1)',
                color: 'var(--color-status-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 20px auto',
              }}
            >
              ✓
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Eligibility Verified!</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '28px' }}>
              Your 18+ adult age and IIT Madras non-campus BS enrolment have been confirmed. You are now authorized to complete your profile and enter dating discovery.
            </p>

            <Link
              href="/discover"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              Enter Dating Discovery
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
