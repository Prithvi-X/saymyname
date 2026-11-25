'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  isApprovedIitmBsEmail,
  normalizeInstitutionalEmail,
  isPrivateIdentifierLike,
  calculateAgeYears,
} from '@saymyname/validation';
import { AccountLifecycleState, ProgrammeFamily } from '@saymyname/contracts';
import { api, VerificationCaseSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { appendSafeReturnUrl, resolveSafeReturnUrl } from '../../lib/return-path';
import { Button, Input, Badge, Avatar } from '../../components/ui';

type OnboardingView =
  | 'register'
  | 'otp'
  | 'age'
  | 'student'
  | 'review'
  | 'profile'
  | 'suspended';

const PROGRAMME_OPTIONS = [
  {
    value: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
    label: 'BS in Data Science and Applications',
  },
  {
    value: ProgrammeFamily.ELECTRONIC_SYSTEMS,
    label: 'BS in Electronic Systems',
  },
  {
    value: ProgrammeFamily.AERONAUTICS_SPACE,
    label: 'BS in Aeronautics and Space Technology',
  },
  {
    value: ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
    label: 'BS in Management and Data Science',
  },
];

const PATHWAY_OPTIONS: Array<{ value: 'foundation' | 'diploma' | 'degree'; label: string }> = [
  { value: 'foundation', label: 'Foundation Level' },
  { value: 'diploma', label: 'Diploma Level' },
  { value: 'degree', label: 'BS Degree Level' },
];

const INTENTION_OPTIONS = [
  'Long-term intentional relationship',
  'Meaningful connection across distance',
  'Getting to know peers calmly first',
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, lifecycleState, isLoading: authLoading, refreshUser } = useAuth();

  const [view, setView] = useState<OnboardingView>('register');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1 & 2: Register + OTP
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Step 3: Age screen
  const [dob, setDob] = useState('');

  // Step 4: Student enrolment case (non-gov-ID optional proof)
  const [programmeFamily, setProgrammeFamily] = useState<string>(
    ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
  );
  const [pathwayCode, setPathwayCode] = useState<'foundation' | 'diploma' | 'degree'>(
    'foundation',
  );
  const [evidenceType, setEvidenceType] = useState<
    'none' | 'student_enrolment_letter' | 'iitm_portal_screenshot' | 'term_fee_receipt'
  >('none');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  // Verification status
  const [cases, setCases] = useState<VerificationCaseSummary[]>([]);

  // Step 5: Profile Onboarding & R2 Portrait Upload (D-P2-04)
  const [profileSection, setProfileSection] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [displayName, setDisplayName] = useState('');
  const [termOrYear, setTermOrYear] = useState('Foundation Level');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [intention, setIntention] = useState(INTENTION_OPTIONS[0]);
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [catalogInterests, setCatalogInterests] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [catalogPrompts, setCatalogPrompts] = useState<
    Array<{ id: string; promptText: string }>
  >([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [promptAnswer, setPromptAnswer] = useState('');
  const [photos, setPhotos] = useState<
    Array<{ id: string; photoUrl: string | null; isPrimary: boolean }>
  >([]);
  const [supportedImageMimes, setSupportedImageMimes] = useState<string[]>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  const loadVerificationAndDraft = useCallback(async () => {
    try {
      const [caseList, catalog, profile] = await Promise.all([
        api.getVerificationCases().catch(() => []),
        api
          .getProfileCatalog()
          .catch(() => ({ interests: [], prompts: [], supportedImageMimes: undefined })),
        api.getProfile().catch(() => null),
      ]);
      setCases(caseList);
      setCatalogInterests(catalog.interests || []);
      setCatalogPrompts(catalog.prompts || []);
      if (Array.isArray(catalog.supportedImageMimes) && catalog.supportedImageMimes.length > 0) {
        setSupportedImageMimes(catalog.supportedImageMimes);
      }
      if (catalog.prompts?.[0] && !selectedPromptId) {
        setSelectedPromptId(catalog.prompts[0].id);
      }
      if (profile) {
        if (profile.displayName && profile.displayName !== 'Member') {
          setDisplayName(profile.displayName);
        }
        if (profile.termOrYear) setTermOrYear(profile.termOrYear);
        if (profile.locationCity) setLocationCity(profile.locationCity);
        if (profile.locationState) setLocationState(profile.locationState);
        if (profile.intention) setIntention(profile.intention);
        if (profile.bio) setBio(profile.bio);
        if (Array.isArray(profile.interests)) {
          setSelectedInterests(profile.interests.map((i) => i.interest.name));
        }
        if (Array.isArray(profile.promptAnswers) && profile.promptAnswers[0]) {
          setSelectedPromptId(profile.promptAnswers[0].promptId || '');
          setPromptAnswer(profile.promptAnswers[0].answerText || '');
        }
        setPhotos(profile.photos || []);
        setConsentAccepted(Boolean(profile.consentAcceptedAt));
      }
    } catch {
      // Initial draft hydration is best-effort
    }
  }, [selectedPromptId]);

  // Map authoritative backend lifecycleState to onboarding view
  useEffect(() => {
    if (authLoading) return;
    const requestedStage = searchParams.get('stage');

    if (lifecycleState === AccountLifecycleState.ACTIVE_MEMBER) {
      router.replace(resolveSafeReturnUrl(searchParams.get('returnUrl'), '/discover'));
      return;
    }

    if (lifecycleState === AccountLifecycleState.SUSPENDED) {
      setView('suspended');
      return;
    }

    if (lifecycleState === AccountLifecycleState.UNAUTHENTICATED) {
      if (requestedStage === 'otp' && email) {
        setView('otp');
      } else {
        setView('register');
      }
      return;
    }

    if (lifecycleState === AccountLifecycleState.EMAIL_PENDING) {
      setView('otp');
      return;
    }

    loadVerificationAndDraft();

    if (lifecycleState === AccountLifecycleState.AGE_VERIFICATION) {
      setView('age');
    } else if (lifecycleState === AccountLifecycleState.STUDENT_VERIFICATION) {
      setView('student');
    } else if (
      lifecycleState === AccountLifecycleState.VERIFICATION_PENDING ||
      lifecycleState === AccountLifecycleState.VERIFICATION_NEEDS_INFORMATION ||
      lifecycleState === AccountLifecycleState.VERIFICATION_REJECTED
    ) {
      setView('review');
    } else if (lifecycleState === AccountLifecycleState.PROFILE_INCOMPLETE) {
      setView('profile');
    }
  }, [authLoading, lifecycleState, router, searchParams, email, loadVerificationAndDraft]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const clean = normalizeInstitutionalEmail(email);
    if (!isApprovedIitmBsEmail(clean)) {
      setError(
        'Phase 1 accepts approved IIT Madras BS study domains (@study.iitm.ac.in, @ds.study.iitm.ac.in, @es.study.iitm.ac.in) only.',
      );
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (regDisplayName.trim() && isPrivateIdentifierLike(regDisplayName)) {
      setError('Display name cannot be an email address or student roll number.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.register({
        email: clean,
        password,
        ...(regDisplayName.trim() ? { displayName: regDisplayName.trim() } : {}),
      });
      setEmail(clean);
      setCooldownSec(res.cooldownSeconds || 60);
      setDevOtpHint(res.devOtp || null);
      setNotice(res.message);
      setView('otp');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldownSec > 0) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.resendOtp(normalizeInstitutionalEmail(email));
      setCooldownSec(res.cooldownSeconds || 60);
      setDevOtpHint(res.devOtp || null);
      setNotice(res.message);
    } catch (err: any) {
      setError(err.message || 'Could not resend code yet.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit verification code from your inbox.');
      return;
    }

    setBusy(true);
    try {
      await api.verifyOtp({ email: normalizeInstitutionalEmail(email), otp: otp.trim() });
      await refreshUser();
      setNotice('Email ownership confirmed. Proceed to the 18+ age check.');
    } catch (err: any) {
      setError(err.message || 'Verification code invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  const handleAgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const calc = calculateAgeYears(dob);
    if (calc === null) {
      setError('Enter a valid calendar date of birth in YYYY-MM-DD format.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.verifyAge({ dateOfBirth: dob });
      setNotice(res.message);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Unable to verify age eligibility.');
      await refreshUser();
    } finally {
      setBusy(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      let evidenceObjectKey: string | undefined;
      let evidenceMimeType: string | undefined;
      let evidenceSizeBytes: number | undefined;

      if (evidenceType !== 'none' && evidenceFile) {
        const presign = await api.presignVerificationEvidence({
          evidenceType,
          mimeType: evidenceFile.type || 'application/pdf',
          fileSizeBytes: evidenceFile.size,
        });
        if (presign.uploadUrl) {
          await api.uploadToPresignedUrl(presign.uploadUrl, evidenceFile);
        }
        evidenceObjectKey = presign.s3Key;
        evidenceMimeType = evidenceFile.type;
        evidenceSizeBytes = evidenceFile.size;
      }

      const res = await api.verifyStudent({
        programmeFamily,
        pathwayCode,
        ...(evidenceObjectKey
          ? {
              evidenceObjectKey,
              evidenceType,
              evidenceMimeType,
              evidenceSizeBytes,
            }
          : {}),
      });
      setNotice(res.message);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Unable to submit student verification case.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfileDraft = async (silent = false) => {
    setError(null);
    if (!silent) setNotice(null);

    if (displayName.trim() && isPrivateIdentifierLike(displayName)) {
      setError(
        'Public display name cannot contain roll numbers, email addresses, or account IDs.',
      );
      return false;
    }

    setBusy(true);
    try {
      await api.updateProfile({
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        bio: bio.trim(),
        termOrYear: termOrYear.trim(),
        locationCity: locationCity.trim(),
        locationState: locationState.trim(),
        intention,
        interests: selectedInterests,
        promptAnswers:
          selectedPromptId && promptAnswer.trim()
            ? [{ promptId: selectedPromptId, answerText: promptAnswer.trim() }]
            : [],
      });
      if (!silent) {
        setNotice('Profile draft saved safely.');
      }
      await loadVerificationAndDraft();
      return true;
    } catch (err: any) {
      setError(err.message || 'Unable to save draft.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);

    if (!supportedImageMimes.includes(file.type.toLowerCase())) {
      const labels = supportedImageMimes
        .map((m) => m.replace('image/', '').toUpperCase())
        .join(', ');
      setError(`Select a supported portrait photo (${labels}).`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Portrait file size must not exceed 10 MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const presign = await api.presignPhoto({
        filename: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
      });

      if (presign.uploadUrl) {
        await api.uploadToPresignedUrl(presign.uploadUrl, file);
      }

      await api.addPhoto({
        s3Key: presign.s3Key,
        mimeType: file.type,
        isPrimary: photos.length === 0,
      });
      await loadVerificationAndDraft();
      setNotice('Portrait uploaded securely to private R2 storage.');
    } catch (err: any) {
      setError(err.message || 'Portrait upload failed.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setError(null);
    setBusy(true);
    try {
      await api.removePhoto(photoId);
      await loadVerificationAndDraft();
    } catch (err: any) {
      setError(err.message || 'Unable to remove photo.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    setNotice(null);

    const saved = await handleSaveProfileDraft(true);
    if (!saved) return;

    setBusy(true);
    try {
      await api.publishProfile({
        isPublished: true,
        acceptGuidelinesConsent: consentAccepted,
      });
      await refreshUser();
      router.push('/discover');
    } catch (err: any) {
      setError(err.message || 'Unable to publish profile yet.');
    } finally {
      setBusy(false);
    }
  };

  const toggleInterest = (name: string) => {
    setSelectedInterests((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : prev.length < 5 ? [...prev, name] : prev,
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] bg-void flex items-center justify-center text-sm text-silver">
        Checking account verification state...
      </div>
    );
  }

  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0] || null;
  const ageRejected = user?.eligibility?.ageStatus === 'rejected';
  const studentRejected = user?.eligibility?.studentStatus === 'rejected';
  const needsInfo =
    user?.eligibility?.ageStatus === 'needs_information' ||
    user?.eligibility?.studentStatus === 'needs_information';

  return (
    <div className="min-h-[calc(100vh-140px)] bg-void smn-ambient-calm smn-stage-wrap text-chalk font-ui py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Indicator Header */}
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-1.5">
            Member Onboarding · Phase 1
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-chalk mb-2">
            {view === 'register' && 'Create your verified account'}
            {view === 'otp' && 'Confirm institutional email ownership'}
            {view === 'age' && 'Confirm 18+ adult eligibility'}
            {view === 'student' && 'Verify IIT Madras BS programme track'}
            {view === 'review' && 'Verification under review'}
            {view === 'profile' && 'Build your Discover profile'}
            {view === 'suspended' && 'Account access paused'}
          </h1>
          <div className="flex flex-wrap sm:grid sm:grid-cols-5 gap-1.5 mt-4">
            {[
              { id: 'register', label: '1. Account' },
              { id: 'otp', label: '2. Email' },
              { id: 'age', label: '3. Age 18+' },
              { id: 'student', label: '4. BS Track' },
              { id: 'profile', label: '5. Profile' },
            ].map((step) => {
              const active =
                view === step.id ||
                (view === 'review' && step.id === 'student');
              return (
                <div
                  key={step.id}
                  className={`px-2.5 py-1.5 rounded-[4px] border text-[11px] font-medium text-center whitespace-nowrap flex-1 min-w-[96px] sm:min-w-0 ${
                    active
                      ? 'bg-iron border-iris text-chalk font-semibold'
                      : 'bg-coal border-edge text-ash'
                  }`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-[8px] bg-danger-subtle border border-danger/40 text-xs sm:text-sm text-danger leading-relaxed"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 p-4 rounded-[8px] bg-success-subtle border border-success/40 text-xs sm:text-sm text-chalk leading-relaxed"
          >
            {notice}
          </div>
        )}

        {/* STEP 1: REGISTRATION */}
        {view === 'register' && (
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8 smn-surface-elevated">
            <p className="text-xs sm:text-sm text-silver mb-6 leading-relaxed">
              Approved institutional BS study email required. Email validation is only the first
              screen—age (18+) and current enrolment review are completed separately. No photo is
              required yet.
            </p>

            <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
              <Input
                label="Approved Institutional BS Email"
                id="reg-email"
                type="email"
                required
                placeholder="name@study.iitm.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Accepts @study.iitm.ac.in, @ds.study.iitm.ac.in, or @es.study.iitm.ac.in."
              />

              <Input
                label="Preferred Display Name (Optional)"
                id="reg-displayName"
                type="text"
                maxLength={50}
                placeholder="How peers should address you"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                helperText="Never enter a student roll number or account ID."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Create Password"
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <Input
                  label="Confirm Password"
                  id="reg-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button type="submit" variant="primary" size="md" isLoading={busy} className="w-full mt-2">
                Create Account &amp; Send Verification Code
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-edge text-center text-xs text-silver">
              Already registered?{' '}
              <Link
                href={appendSafeReturnUrl('/login', searchParams.get('returnUrl'))}
                className="text-iris hover:text-iris-hover font-semibold"
              >
                Sign in with password →
              </Link>
            </div>
          </div>
        )}

        {/* STEP 2: EMAIL OTP VERIFICATION */}
        {view === 'otp' && (
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8 shadow-md">
            <p className="text-xs sm:text-sm text-silver mb-5 leading-relaxed">
              Enter the 6-digit verification code sent to{' '}
              <strong className="text-chalk">{email || user?.email}</strong>. Codes expire after
              10 minutes and lock after 5 incorrect attempts.
            </p>

            {devOtpHint && (
              <div className="mb-4 p-3 rounded-[6px] bg-iron border border-iris/40 text-xs text-silver font-mono">
                Non-production verification code: <strong className="text-chalk">{devOtpHint}</strong>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4" noValidate>
              <Input
                label="6-Digit Verification Code"
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" variant="primary" size="md" isLoading={busy} className="flex-1">
                  Verify Email &amp; Continue
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={cooldownSec > 0 || busy}
                  onClick={handleResendOtp}
                >
                  {cooldownSec > 0 ? `Resend in ${cooldownSec}s` : 'Resend Code'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: AGE ELIGIBILITY (18+ STRICT BOUNDARY, NO GOV ID COLLECTION) */}
        {view === 'age' && (
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8 shadow-md">
            <p className="text-xs sm:text-sm text-silver mb-5 leading-relaxed">
              SayMyName is strictly for adults aged 18 and older (Document 01 §3.5). Self-declared
              birth dates create an age eligibility case queued for verification—never displayed
              directly on public profiles. Government ID uploads are not requested at this stage.
            </p>

            <form onSubmit={handleAgeSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                label="Date of Birth (YYYY-MM-DD)"
                id="dob-input"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                helperText="Only your minimum 18+ eligibility outcome is retained cleanly."
              />

              <Button type="submit" variant="primary" size="md" isLoading={busy}>
                Submit 18+ Eligibility Check
              </Button>
            </form>
          </div>
        )}

        {/* STEP 4: STUDENT PROGRAMME & PATHWAY CASE */}
        {view === 'student' && (
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8 shadow-md">
            <p className="text-xs sm:text-sm text-silver mb-5 leading-relaxed">
              Select your active IIT Madras non-campus BS programme family and academic pathway.
              Optionally attach non-government-ID institutional enrolment proof into private R2
              storage to speed up verification review. Photos for Discover remain optional until
              publication.
            </p>

            <form onSubmit={handleStudentSubmit} className="flex flex-col gap-5" noValidate>
              <div>
                <label
                  htmlFor="programme-select"
                  className="text-xs font-medium text-silver block mb-1.5"
                >
                  Approved IITM BS Programme Family
                </label>
                <select
                  id="programme-select"
                  value={programmeFamily}
                  onChange={(e) => setProgrammeFamily(e.target.value)}
                  className="w-full h-12 px-3.5 bg-iron text-chalk border border-edge rounded-[4px] text-sm focus:border-iris outline-none"
                >
                  {PROGRAMME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-xs font-medium text-silver block mb-2">
                  Current Academic Level (Pathway)
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {PATHWAY_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setPathwayCode(opt.value)}
                      className={`h-11 px-3 rounded-[6px] border text-xs font-medium transition-colors ${
                        pathwayCode === opt.value
                          ? 'bg-slate border-iris text-chalk font-semibold'
                          : 'bg-iron border-edge text-silver hover:text-chalk'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-[8px] bg-iron/70 border border-edge space-y-3">
                <div>
                  <label
                    htmlFor="evidence-type"
                    className="text-xs font-medium text-chalk block mb-1"
                  >
                    Optional Non-Gov-ID Institutional Proof
                  </label>
                  <p className="text-[11px] text-ash mb-2">
                    Do not upload Aadhaar, PAN, Passport, or government ID documents. Institutional
                    BS enrolment letters or term receipts only.
                  </p>
                  <select
                    id="evidence-type"
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value as any)}
                    className="w-full h-10 px-3 bg-coal text-chalk border border-edge rounded-[4px] text-xs outline-none"
                  >
                    <option value="none">Submit case without document first</option>
                    <option value="student_enrolment_letter">IITM BS Enrolment Letter</option>
                    <option value="iitm_portal_screenshot">IITM BS Student Portal Screenshot</option>
                    <option value="term_fee_receipt">Term Registration / Fee Receipt</option>
                  </select>
                </div>

                {evidenceType !== 'none' && (
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    className="text-xs text-silver file:mr-3 file:py-1.5 file:px-3 file:rounded-[4px] file:border file:border-edge file:bg-coal file:text-chalk"
                  />
                )}
              </div>

              <Button type="submit" variant="primary" size="md" isLoading={busy}>
                Submit Student Enrolment Case for Review
              </Button>
            </form>
          </div>
        )}

        {/* VERIFICATION PENDING / NEEDS INFO / REJECTED + OPTIONAL DRAFT SAVE */}
        {view === 'review' && (
          <div className="space-y-6">
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-chalk">Verification Status</h2>
                {ageRejected || studentRejected ? (
                  <Badge variant="danger" size="md">Not Eligible</Badge>
                ) : needsInfo ? (
                  <Badge variant="warning" size="md">Needs Information</Badge>
                ) : (
                  <Badge variant="warning" size="md">Pending Review</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="p-4 rounded-[8px] bg-iron border border-edge">
                  <p className="text-[11px] uppercase tracking-wider text-ash mb-1">
                    Age 18+ Check
                  </p>
                  <p className="text-sm font-semibold text-chalk capitalize">
                    {user?.eligibility?.ageStatus || 'pending'}
                  </p>
                </div>
                <div className="p-4 rounded-[8px] bg-iron border border-edge">
                  <p className="text-[11px] uppercase tracking-wider text-ash mb-1">
                    Student Enrolment
                  </p>
                  <p className="text-sm font-semibold text-chalk capitalize">
                    {user?.eligibility?.studentStatus || 'pending'}
                  </p>
                </div>
              </div>

              {cases.length > 0 && (
                <div className="space-y-2 mb-5">
                  <p className="text-xs font-medium text-silver">Submitted Cases</p>
                  {cases.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-void border border-edge rounded-[6px] text-xs"
                    >
                      <span className="text-chalk font-medium capitalize">
                        {c.checkType.replace('_', ' ')} ({c.providerCode})
                      </span>
                      <span className="text-silver capitalize">{c.status}</span>
                      {c.rejectionReason && (
                        <p className="w-full text-warning text-[11px] mt-1">{c.rejectionReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {ageRejected ? (
                <p className="text-xs sm:text-sm text-danger leading-relaxed">
                  Your account did not pass the strict 18+ minimum age rule and cannot access
                  dating features.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await refreshUser();
                      await loadVerificationAndDraft();
                    }}
                  >
                    Refresh Verification Status
                  </Button>
                  {needsInfo && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setView('student')}
                    >
                      Resubmit Student Information
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Allow saving incomplete profile drafts even while waiting for verification (D-P2-04) */}
            {!ageRejected && !studentRejected && (
              <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-chalk">
                      Save an Incomplete Profile Draft Meanwhile
                    </h2>
                    <p className="text-xs text-silver mt-0.5">
                      Optional while awaiting review. Portrait upload is not required to save a draft.
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm">Draft Only</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <Input
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="First name or preferred name"
                  />
                  <Input
                    label="Coarse City"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Pune"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={busy}
                  onClick={() => handleSaveProfileDraft(false)}
                >
                  Save Draft Without Photo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: GUIDED PROFILE ONBOARDING + PORTRAIT UPLOAD + PUBLISH GATE */}
        {view === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-coal border border-edge rounded-[12px] p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between border-b border-edge pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 1, label: 'Identity' },
                    { id: 2, label: 'Bio' },
                    { id: 3, label: 'Interests' },
                    { id: 4, label: 'Portrait' },
                    { id: 5, label: 'Publish' },
                  ].map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => setProfileSection(tab.id as any)}
                      className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                        profileSection === tab.id
                          ? 'bg-slate border-iris text-chalk'
                          : 'bg-iron border-edge text-silver hover:text-chalk'
                      }`}
                    >
                      {tab.id}. {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {profileSection === 1 && (
                <div className="space-y-4">
                  <Input
                    label="Public Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Ananya"
                    helperText="Roll numbers, emails, and UUIDs are rejected."
                  />
                  <Input
                    label="Academic Context / Term"
                    value={termOrYear}
                    onChange={(e) => setTermOrYear(e.target.value)}
                    placeholder="e.g. Diploma in Data Science, Term 4"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="City (Coarse Location Only)"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                    />
                    <Input
                      label="State"
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      placeholder="e.g. Karnataka"
                    />
                  </div>
                </div>
              )}

              {profileSection === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-silver block mb-1.5">
                      Relationship Intention
                    </label>
                    <select
                      value={intention}
                      onChange={(e) => setIntention(e.target.value)}
                      className="w-full h-12 px-3.5 bg-iron text-chalk border border-edge rounded-[4px] text-sm outline-none"
                    >
                      {INTENTION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="onb-bio"
                      className="text-xs font-medium text-silver block mb-1.5"
                    >
                      About You (Min. 20, Max. 500 characters)
                    </label>
                    <textarea
                      id="onb-bio"
                      rows={4}
                      maxLength={500}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="What excites you in your studies or offline routines?"
                      className="w-full p-3.5 bg-iron text-chalk border border-edge rounded-[4px] text-sm outline-none focus:border-iris"
                    />
                    <p className="text-right text-xs text-ash font-mono mt-1">
                      {bio.length}/500
                    </p>
                  </div>
                </div>
              )}

              {profileSection === 3 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-medium text-silver mb-2">
                      Select up to 5 interests ({selectedInterests.length}/5)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {catalogInterests.map((item) => {
                        const active = selectedInterests.includes(item.name);
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => toggleInterest(item.name)}
                            className={`px-3 py-1.5 rounded-[4px] border text-xs transition-colors ${
                              active
                                ? 'bg-iris text-stage border-iris font-semibold'
                                : 'bg-iron text-silver border-edge hover:text-chalk'
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-edge">
                    <label className="text-xs font-medium text-silver block">
                      Conversation Prompt (Optional Draft)
                    </label>
                    <select
                      value={selectedPromptId}
                      onChange={(e) => setSelectedPromptId(e.target.value)}
                      className="w-full h-11 px-3 bg-iron text-chalk border border-edge rounded-[4px] text-xs outline-none"
                    >
                      {catalogPrompts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.promptText}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={3}
                      maxLength={250}
                      value={promptAnswer}
                      onChange={(e) => setPromptAnswer(e.target.value)}
                      placeholder="Write a genuine reflection (up to 250 chars)..."
                      className="w-full p-3 bg-iron text-chalk border border-edge rounded-[4px] text-sm outline-none"
                    />
                  </div>
                </div>
              )}

              {profileSection === 4 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-[8px] bg-iron border border-edge">
                    <p className="text-xs font-semibold text-chalk mb-1">
                      Private Portrait Photograph (Required before Publishing)
                    </p>
                    <p className="text-xs text-silver leading-relaxed mb-3">
                      Your portrait is uploaded directly to private Cloudflare R2 storage and
                      viewed via short-lived signed access. At least one genuine portrait photo is
                      required to enter Discover.
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-iris text-stage text-xs font-semibold cursor-pointer hover:bg-iris-hover transition-colors">
                      <span>{isUploadingPhoto ? 'Uploading...' : '+ Upload Portrait Photo'}</span>
                      <input
                        type="file"
                        accept={supportedImageMimes.join(',')}
                        onChange={handlePhotoUpload}
                        disabled={isUploadingPhoto}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {photos.length === 0 ? (
                    <p className="text-xs text-warning">
                      No portraits uploaded yet. You can save an incomplete draft, and upload a
                      portrait whenever ready to publish.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="bg-void border border-edge rounded-[8px] overflow-hidden flex flex-col"
                        >
                          <div className="h-32 bg-iron flex items-center justify-center overflow-hidden">
                            {photo.photoUrl ? (
                              <img
                                src={photo.photoUrl}
                                alt="Uploaded member portrait preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[11px] text-ash px-2 text-center">
                                Private R2 Object Attached
                              </span>
                            )}
                          </div>
                          <div className="p-2 flex items-center justify-between text-[11px]">
                            <span className={photo.isPrimary ? 'text-iris font-semibold' : 'text-ash'}>
                              {photo.isPrimary ? 'Primary' : 'Gallery'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photo.id)}
                              className="text-danger hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {profileSection === 5 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-[8px] bg-iron border border-edge space-y-2 text-xs text-silver">
                    <p className="font-semibold text-chalk">Publication Checklist</p>
                    <p>• Display name set: {displayName.trim() ? '✓' : 'Required'}</p>
                    <p>• Bio (&ge;20 chars): {bio.trim().length >= 20 ? '✓' : 'Needs completion'}</p>
                    <p>• City &amp; State: {locationCity.trim() && locationState.trim() ? '✓' : 'Required'}</p>
                    <p>• At least 1 R2 portrait photo: {photos.length >= 1 ? '✓' : 'Required before Discover'}</p>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-silver cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => setConsentAccepted(e.target.checked)}
                      className="mt-0.5 accent-[#8580C4]"
                    />
                    <span>
                      I confirm my profile uses authentic information and I agree to SayMyName&apos;s{' '}
                      <Link href="/safety" className="text-iris underline">
                        Safety &amp; Mutual Consent Rules
                      </Link>{' '}
                      and{' '}
                      <Link href="/terms" className="text-iris underline">
                        Terms of Use
                      </Link>
                      .
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={busy}
                  onClick={() => handleSaveProfileDraft(false)}
                >
                  Save Draft
                </Button>

                <div className="flex items-center gap-2">
                  {profileSection < 5 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setProfileSection((s) => Math.min(5, s + 1) as any)}
                    >
                      Next Step →
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={busy}
                      onClick={handlePublish}
                    >
                      Publish to Discover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Preview Rail */}
            <div className="lg:col-span-5 bg-coal border border-edge rounded-[12px] overflow-hidden">
              <div className="h-56 bg-iron flex items-center justify-center relative">
                {primaryPhoto?.photoUrl ? (
                  <img
                    src={primaryPhoto.photoUrl}
                    alt="Discover card portrait preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-ash">
                    <Avatar size="xl" name={displayName || 'Member'} />
                    <span className="text-xs">Upload a portrait to enable Discover</span>
                  </div>
                )}
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-chalk">
                    {displayName.trim() || 'Your Display Name'}
                  </h3>
                  <Badge variant="verified" size="sm">Verified</Badge>
                </div>
                <p className="text-xs text-silver">
                  {termOrYear}
                  {locationCity ? ` · ${locationCity}` : ''}
                </p>
                <p className="text-xs text-silver leading-relaxed">
                  {bio.trim() || 'Your authentic biography appears here as you save your draft.'}
                </p>
                {selectedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedInterests.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[11px] bg-iron border border-edge rounded-[4px] text-silver"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'suspended' && (
          <div className="bg-coal border border-danger/40 rounded-[12px] p-6 sm:p-8">
            <p className="text-sm text-danger leading-relaxed mb-4">
              This account is currently suspended or closed and cannot access discovery or member
              tools.
            </p>
            <Link href="/support">
              <Button variant="secondary" size="sm">
                View Member Support Options
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] bg-void flex items-center justify-center text-sm text-silver">
          Loading member onboarding...
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
