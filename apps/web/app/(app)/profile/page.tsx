'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { api, sanitizeDisplayName } from '../../../lib/api';
import {
  Button,
  Input,
  Badge,
} from '../../../components/ui';
import {
  ShieldIcon,
  LockIcon,
  InfoIcon,
  PinIcon,
  UserIcon,
} from '../../../components/icons';

const PROGRAMME_LABELS: Record<string, string> = {
  data_science_applications: 'BS in Data Science and Applications',
  electronic_systems: 'BS in Electronic Systems',
  aeronautics_space: 'BS in Aeronautics and Space Technology',
  management_data_science: 'BS in Management and Data Science',
};

const AVAILABLE_INTERESTS = [
  '☕ Filter Coffee',
  '🎬 World Cinema',
  '🧩 Word Games',
  '📊 Machine Learning',
  '⚡ Embedded Systems',
  '📚 Speculative Fiction',
  '🏸 Badminton',
  '🚀 Orbital Mechanics',
  '♟️ Chess',
  '🍵 Earl Grey',
  '🎧 Synthwave & Lo-Fi',
  '🌱 Urban Gardening',
  '🚲 Night Cycling',
  '✍️ Creative Writing',
];

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();

  // Tab State: 'public' | 'private'
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

  // Public Profile State (Synchronized to authenticated member context)
  const initialCleanName = sanitizeDisplayName(user?.displayName);
  const [displayName, setDisplayName] = useState(initialCleanName);
  const [age] = useState(22);
  const [programmeFamily, setProgrammeFamily] = useState(
    user?.eligibility?.programmeFamily || 'data_science_applications'
  );
  const [currentTerm, setCurrentTerm] = useState('Foundation Level');
  const [locationCity, setLocationCity] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    '☕ Filter Coffee',
    '📊 Machine Learning',
  ]);
  const [promptQuestion, setPromptQuestion] = useState('My ideal offline conversation is over...');
  const [promptAnswer, setPromptAnswer] = useState('');

  // Form & Network Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Private Settings State
  const [isDiscoveryPaused, setIsDiscoveryPaused] = useState(false);

  useEffect(() => {
    if (user) {
      const clean = sanitizeDisplayName(user.displayName);
      if (clean) setDisplayName(clean);
      if (user.eligibility?.programmeFamily) setProgrammeFamily(user.eligibility.programmeFamily);
      if ((user as any).profile) {
        const p = (user as any).profile;
        if (p.bio) setBio(p.bio);
        if (p.locationCity) setLocationCity(p.locationCity);
        if (p.termOrYear) setCurrentTerm(p.termOrYear);
        if (Array.isArray(p.photos) && p.photos[0]?.photoUrl) {
          setPhotoUrl(p.photos[0].photoUrl);
          setImageError(false);
        }
      }
    }
  }, [user]);

  // Reset image error state whenever user changes photo URL
  const handlePhotoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoUrl(e.target.value);
    setImageError(false);
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveFeedback(null);
    setIsSaving(true);

    try {
      await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        termOrYear: currentTerm.trim(),
        locationCity: locationCity.trim(),
      });
      await refreshUser();
      setSaveFeedback('Profile changes successfully updated and saved.');
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const maskedEmail = user?.email
    ? `${user.email.slice(0, 3)}*****@${user.email.split('@')[1]}`
    : 'Encrypted';
  const maskedRoll = (user as any)?.eligibility?.reviewNotes || 'Verified Active Enrolment';

  const selectedProgrammeLabel =
    PROGRAMME_LABELS[programmeFamily] || 'BS in Data Science and Applications';

  // Sanitized display name for preview
  const previewName = sanitizeDisplayName(displayName);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-ui">
      {/* Editorial Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-iris">
            STUDENT PROFILE • PHASE 1
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-chalk m-0">
          Profile & Account Settings
        </h1>
        <p className="text-sm text-silver mt-1.5 max-w-2xl leading-relaxed">
          Manage your verified presence seen by peers in daily discovery, and review your confidential student verification vault.
        </p>
      </div>

      {/* Segmented Tab Bar */}
      <div
        role="tablist"
        aria-label="Profile Sections"
        className="flex items-center gap-2 border-b border-edge mb-8 overflow-x-auto"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'public'}
          onClick={() => setActiveTab('public')}
          className={`h-11 px-4 inline-flex items-center gap-2 text-sm font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-iris ${
            activeTab === 'public'
              ? 'text-chalk border-b-2 border-iris font-semibold'
              : 'text-ash hover:text-silver'
          }`}
        >
          <UserIcon size={16} color={activeTab === 'public' ? 'var(--smn-accent-iris, #8580C4)' : 'currentColor'} />
          <span>Public Profile & Discovery Card</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'private'}
          onClick={() => setActiveTab('private')}
          className={`h-11 px-4 inline-flex items-center gap-2 text-sm font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-iris ${
            activeTab === 'private'
              ? 'text-chalk border-b-2 border-iris font-semibold'
              : 'text-ash hover:text-silver'
          }`}
        >
          <LockIcon size={16} color={activeTab === 'private' ? 'var(--smn-accent-iris, #8580C4)' : 'currentColor'} />
          <span>Confidential Verification & Privacy</span>
        </button>
      </div>

      {saveFeedback && (
        <div
          role="status"
          className="p-3.5 mb-6 bg-[#10241A] border border-success/40 text-success rounded-[6px] text-sm font-medium text-center shadow-sm flex items-center justify-center gap-2"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{saveFeedback}</span>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="p-3.5 mb-6 bg-[#2E1417] border border-danger/40 text-danger rounded-[6px] text-sm font-medium text-center shadow-sm flex items-center justify-center gap-2"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}

      {/* TAB 1: PUBLIC PROFILE & DISCOVERY CARD */}
      {activeTab === 'public' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Profile Form (7 cols on desktop) */}
          <form onSubmit={handleSave} className="lg:col-span-7 flex flex-col gap-6">
            {/* Basic Info Card */}
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-7 flex flex-col gap-5">
              <h2 className="text-lg font-semibold text-chalk m-0 tracking-tight">
                Essential Profile Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Public Display Name"
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    helperText="How peers see you. Institutional roll numbers are strictly prohibited."
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-silver select-none tracking-wide block mb-1.5">
                    Age (Verified)
                  </label>
                  <div className="w-full h-12 bg-iron text-silver rounded-[4px] border border-edge/60 px-3.5 flex items-center justify-between text-sm select-none">
                    <span>{age} years</span>
                    <Badge variant="verified" size="sm">Verified</Badge>
                  </div>
                  <p className="text-xs text-ash mt-1.5">
                    Age is verified via government ID and cannot be altered.
                  </p>
                </div>
              </div>

              {/* Verified Programme Information (Immutable per Document 01) */}
              <div>
                <label className="text-xs font-medium text-silver select-none tracking-wide block mb-1.5">
                  Academic Programme Track (Verified)
                </label>
                <div className="w-full h-12 bg-iron text-chalk rounded-[4px] border border-edge/60 px-3.5 flex items-center justify-between text-sm select-none">
                  <span className="font-medium truncate">{selectedProgrammeLabel}</span>
                  <Badge variant="programme" size="sm">Verified Track</Badge>
                </div>
                <p className="text-xs text-ash mt-1.5">
                  Programme track is cryptographically verified from your IITM record and is immutable.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Academic Level / Term"
                    id="currentTerm"
                    type="text"
                    value={currentTerm}
                    onChange={(e) => setCurrentTerm(e.target.value)}
                    placeholder="e.g. Foundation Level, Term 4"
                    helperText="Optional context for remote study peers."
                  />
                </div>

                <div>
                  <Input
                    label="Location (City / State)"
                    id="locationCity"
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Bengaluru, Karnataka"
                    helperText="City/region level only. No exact GPS is ever used."
                  />
                </div>
              </div>

              <div>
                <Input
                  label="Primary Portrait Photo (URL)"
                  id="portraitUrl"
                  type="url"
                  value={photoUrl}
                  onChange={handlePhotoUrlChange}
                  placeholder="https://..."
                  helperText="Natural portraits representing yourself. If URL is unreachable, an elegant monogram is rendered."
                />
              </div>
            </div>

            {/* Bio & Passions Card */}
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-7 flex flex-col gap-5">
              <h2 className="text-lg font-semibold text-chalk m-0 tracking-tight">
                Bio & Intellectual Passions
              </h2>

              <div>
                <label htmlFor="bioText" className="text-xs font-medium text-silver select-none tracking-wide block mb-1.5">
                  Personal Biography (Max 500 characters)
                </label>
                <textarea
                  id="bioText"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 500))}
                  rows={4}
                  placeholder="Share your intellectual rhythm, remote study habits, or offline interests..."
                  className="w-full min-h-[110px] p-3.5 bg-iron text-chalk placeholder-ash/70 rounded-[4px] border border-edge hover:border-[#45505E] focus:border-iris focus:ring-1 focus:ring-iris font-ui text-sm resize-y outline-none transition-colors"
                />
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-xs text-ash">
                    Share your remote study habits or offline interests.
                  </span>
                  <span className="text-xs text-silver font-mono font-medium">
                    {500 - bio.length} chars left
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-silver select-none tracking-wide block mb-2">
                  Interests & Academic Passions (Select up to 5 • {selectedInterests.length}/5 selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`text-xs px-2.5 py-1.5 rounded-[4px] font-ui transition-colors border select-none ${
                          isSelected
                            ? 'bg-[#1C1C2E] text-iris border-iris font-semibold'
                            : 'bg-iron text-silver border-edge hover:border-[#4B5665]'
                        }`}
                      >
                        {interest} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Conversation Starter Prompt */}
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-7 flex flex-col gap-5">
              <h2 className="text-lg font-semibold text-chalk m-0 tracking-tight">
                Conversation Starter Prompt
              </h2>

              <div>
                <label htmlFor="promptQuestion" className="text-xs font-medium text-silver select-none tracking-wide block mb-1.5">
                  Prompt Question
                </label>
                <select
                  id="promptQuestion"
                  value={promptQuestion}
                  onChange={(e) => setPromptQuestion(e.target.value)}
                  className="w-full h-12 bg-iron text-chalk rounded-[4px] border border-edge px-3.5 text-sm outline-none focus:border-iris cursor-pointer font-ui"
                >
                  <option value="My ideal offline conversation is over...">My ideal offline conversation is over...</option>
                  <option value="A technical subject I could discuss endlessly is...">A technical subject I could discuss endlessly is...</option>
                  <option value="My favourite remote study spot or ritual is...">My favourite remote study spot or ritual is...</option>
                  <option value="A non-academic obsession of mine is...">A non-academic obsession of mine is...</option>
                </select>
              </div>

              <div>
                <label htmlFor="promptAnswer" className="text-xs font-medium text-silver select-none tracking-wide block mb-1.5">
                  Your Answer
                </label>
                <textarea
                  id="promptAnswer"
                  value={promptAnswer}
                  onChange={(e) => setPromptAnswer(e.target.value.slice(0, 240))}
                  rows={2}
                  className="w-full min-h-[72px] p-3.5 bg-iron text-chalk placeholder-ash/70 rounded-[4px] border border-edge hover:border-[#45505E] focus:border-iris focus:ring-1 focus:ring-iris font-ui text-sm resize-y outline-none transition-colors"
                  placeholder="Give prospective matches something meaningful to connect on..."
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSaving}
              >
                Save Profile Changes
              </Button>
            </div>
          </form>

          {/* Right Column: Live Discovery Card Preview (5 cols on desktop) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ash">
                LIVE PREVIEW • HOW PEERS SEE YOU
              </span>
              <Badge variant="verified" size="sm">Verified View</Badge>
            </div>

            {/* Candidate Card Mirror */}
            <div className="bg-coal border border-edge rounded-[12px] overflow-hidden shadow-xl">
              {/* Photo Stage with Resilient Fallback */}
              <div className="h-96 relative bg-iron overflow-hidden flex items-center justify-center">
                {photoUrl && !imageError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={`${previewName || 'Member'}'s profile portrait`}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover object-center block"
                  />
                ) : (
                  /* Stylized Architectural Monogram Placeholder (Document 10: MASS & CUT) */
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-iron to-coal p-6 text-center select-none">
                    <div className="w-20 h-20 rounded-[8px] bg-slate border border-edge flex items-center justify-center text-chalk text-2xl font-bold mb-3 shadow-inner">
                      {previewName ? previewName.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <span className="text-xs text-silver font-medium">
                      {photoUrl ? 'Image unreachable • Monogram fallback' : 'No photo uploaded'}
                    </span>
                    <span className="text-[11px] text-ash mt-1">
                      Add a public portrait URL on the left to preview
                    </span>
                  </div>
                )}

                {/* Scrim Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-stage/95 via-stage/40 to-transparent pointer-events-none" />

                {/* Badge Overlay & Identity */}
                <div className="absolute bottom-4 left-5 right-5 text-chalk">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="verified" size="sm">Verified</Badge>

                    {locationCity && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] bg-coal/80 backdrop-blur-xs text-silver border border-edge/80">
                        <PinIcon size={11} color="currentColor" />
                        <span>{locationCity}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-2xl font-bold text-chalk m-0 tracking-tight">
                    {previewName ? `${previewName}, ${age}` : `Add your display name, ${age}`}
                  </h3>

                  <p className="m-0 text-xs font-medium text-silver/90 mt-1">
                    {selectedProgrammeLabel} {currentTerm ? `• ${currentTerm}` : ''}
                  </p>
                </div>
              </div>

              {/* Bio & Details Section */}
              <div className="p-5 flex flex-col gap-4">
                <p className="text-sm text-silver leading-relaxed m-0">
                  {bio || <span className="italic text-ash">No personal biography written yet.</span>}
                </p>

                {/* Interest Tags */}
                {selectedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInterests.map((interest) => (
                      <Badge key={interest} variant="neutral" size="sm">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Prompt Quote Card */}
                {promptAnswer && (
                  <div className="p-3.5 bg-iron border-l-2 border-iris rounded-r-[6px] flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-iris uppercase tracking-wide">
                      {promptQuestion}
                    </span>
                    <p className="text-xs text-silver m-0 leading-relaxed italic">
                      &ldquo;{promptAnswer}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Privacy Clarification Note */}
            <div className="p-3.5 bg-coal border border-edge/80 rounded-[8px] flex items-start gap-2.5">
              <InfoIcon size={16} color="var(--smn-accent-iris, #8580C4)" className="shrink-0 mt-0.5" />
              <p className="m-0 text-xs text-silver leading-relaxed">
                <strong className="text-chalk font-semibold">Strict Privacy Invariant:</strong> Your institutional email, student roll number, and exact date of birth are never exposed to prospective matches.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIDENTIAL VERIFICATION & PRIVACY */}
      {activeTab === 'private' && (
        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Institutional Verification Card */}
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8">
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-iris">
                <ShieldIcon size={22} color="currentColor" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-chalk m-0 tracking-tight">
                  Student Verification Vault
                </h2>
                <p className="m-0 text-xs text-silver mt-0.5">
                  Cryptographically secured enrolment records under Document 01 §3.5
                </p>
              </div>
            </div>

            {/* Data Invariants List */}
            <div className="flex flex-col gap-3.5 bg-iron/70 p-5 rounded-[8px] border border-edge/80 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Enrolment Status:</span>
                <span className="font-semibold text-success flex items-center gap-1.5">
                  <Badge variant="verified" size="sm">Active BS Student</Badge>
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Programme Family:</span>
                <span className="font-semibold text-chalk">
                  {selectedProgrammeLabel}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Masked Institutional Email:</span>
                <span className="font-semibold text-chalk font-mono">
                  {maskedEmail}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Masked Student Roll No:</span>
                <span className="font-semibold text-chalk font-mono">
                  {maskedRoll}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Adult Age Eligibility:</span>
                <span className="font-semibold text-success">
                  18+ Verified (DPDP Compliant)
                </span>
              </div>
            </div>

            <p className="m-0 text-xs text-ash leading-relaxed">
              <strong className="text-silver font-semibold">Institutional Boundary Notice:</strong> SayMyName is an independent platform for verified learners and is not owned, operated, or endorsed by IIT Madras. Academic records are verified solely to preserve a safe, adult, peer-exclusive community.
            </p>
          </div>

          {/* Discovery Controls Card */}
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-chalk m-0 mb-4 tracking-tight">
              Discovery & Cadence Controls
            </h2>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-edge">
              <div>
                <h3 className="text-sm font-semibold text-chalk m-0 mb-1">
                  Pause Discovery
                </h3>
                <p className="m-0 text-xs text-silver max-w-md leading-relaxed">
                  Take a calm pause from new daily candidate batches. Existing mutual matches, conversations, and calls remain intact.
                </p>
              </div>

              <Button
                type="button"
                variant={isDiscoveryPaused ? 'warm' : 'secondary'}
                size="sm"
                onClick={() => setIsDiscoveryPaused(!isDiscoveryPaused)}
              >
                {isDiscoveryPaused ? '✓ Discovery Paused' : 'Active in Discovery'}
              </Button>
            </div>

            {/* Invariant Highlights */}
            <div className="pt-5 flex flex-col gap-2.5">
              <div className="flex gap-2 items-baseline text-xs text-silver leading-relaxed">
                <span className="text-iris font-bold">•</span>
                <span>
                  <strong className="text-chalk">Bilateral Consent:</strong> A Like is never permission to message. Private messaging unlocks only upon mutual match.
                </span>
              </div>
              <div className="flex gap-2 items-baseline text-xs text-silver leading-relaxed">
                <span className="text-iris font-bold">•</span>
                <span>
                  <strong className="text-chalk">Zero Surveillance:</strong> Relationship Mode requires mutual activation, allows unilateral exit at any time, and never tracks live GPS locations.
                </span>
              </div>
              <div className="flex gap-2 items-baseline text-xs text-silver leading-relaxed">
                <span className="text-iris font-bold">•</span>
                <span>
                  <strong className="text-chalk">Private Correspondence:</strong> Audio calls are unrecorded by default. Private messages are never indexed for third-party advertising or public AI model training.
                </span>
              </div>
            </div>
          </div>

          {/* Account Actions & Logout */}
          <div className="bg-coal border border-edge rounded-[12px] p-6 flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/safety" className="w-full sm:w-1/2">
              <Button variant="secondary" size="md" className="w-full">
                <ShieldIcon size={16} color="currentColor" />
                <span>Safety Commitments</span>
              </Button>
            </Link>

            <Button
              variant="destructive"
              size="md"
              onClick={handleLogout}
              className="w-full sm:w-1/2"
            >
              Sign Out of Account
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
