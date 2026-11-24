'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { isPrivateIdentifierLike } from '@saymyname/validation';
import { useAuth } from '../../../lib/auth-context';
import { api, sanitizeDisplayName } from '../../../lib/api';
import { Button, Input, Badge } from '../../../components/ui';
import { ShieldIcon, LockIcon, InfoIcon, PinIcon, UserIcon } from '../../../components/icons';

const PROGRAMME_LABELS: Record<string, string> = {
  data_science_applications: 'BS in Data Science and Applications',
  electronic_systems: 'BS in Electronic Systems',
  aeronautics_space: 'BS in Aeronautics and Space Technology',
  management_data_science: 'BS in Management and Data Science',
};

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

  const initialCleanName = sanitizeDisplayName(user?.displayName);
  const [displayName, setDisplayName] = useState(initialCleanName);
  const [programmeFamily, setProgrammeFamily] = useState(
    user?.eligibility?.programmeFamily || 'data_science_applications',
  );
  const [currentTerm, setCurrentTerm] = useState('Foundation Level');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [intention, setIntention] = useState('Long-term intentional relationship');
  const [bio, setBio] = useState('');

  const [photos, setPhotos] = useState<
    Array<{ id: string; photoUrl: string | null; isPrimary: boolean }>
  >([]);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [catalogInterests, setCatalogInterests] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [catalogPrompts, setCatalogPrompts] = useState<
    Array<{ id: string; promptText: string }>
  >([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [promptAnswer, setPromptAnswer] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDiscoveryPaused, setIsDiscoveryPaused] = useState(false);
  const [isTogglingDiscovery, setIsTogglingDiscovery] = useState(false);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  const hydrateProfile = useCallback(async () => {
    try {
      const [profile, catalog] = await Promise.all([
        api.getProfile(),
        api.getProfileCatalog().catch(() => ({ interests: [], prompts: [] })),
      ]);

      setCatalogInterests(catalog.interests || []);
      setCatalogPrompts(catalog.prompts || []);

      const clean = sanitizeDisplayName(profile.displayName);
      if (clean && clean !== 'Member') setDisplayName(clean);
      if (profile.programmeFamily) setProgrammeFamily(profile.programmeFamily);
      if (profile.termOrYear) setCurrentTerm(profile.termOrYear);
      if (profile.locationCity) setLocationCity(profile.locationCity);
      if (profile.locationState) setLocationState(profile.locationState);
      if (profile.intention) setIntention(profile.intention);
      if (profile.bio) setBio(profile.bio);
      setIsDiscoveryPaused(Boolean(profile.isPaused) || !profile.isPublished);
      setPhotos(profile.photos || []);
      setImageLoadFailed(false);

      if (Array.isArray(profile.interests)) {
        setSelectedInterests(profile.interests.map((i) => i.interest.name));
      }
      if (Array.isArray(profile.promptAnswers) && profile.promptAnswers[0]) {
        setSelectedPromptId(profile.promptAnswers[0].promptId || '');
        setPromptAnswer(profile.promptAnswers[0].answerText || '');
      } else if (catalog.prompts?.[0]) {
        setSelectedPromptId(catalog.prompts[0].id);
      }
    } catch {
      // Initial load stays silent; guard handles auth
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      hydrateProfile();
    }
  }, [user?.id, hydrateProfile]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 5
          ? [...prev, interest]
          : prev,
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveFeedback(null);

    const trimmed = displayName.trim();
    if (!trimmed || isPrivateIdentifierLike(trimmed)) {
      setSaveError(
        'Display name must be valid text and cannot contain roll numbers, emails, or account IDs.',
      );
      return;
    }

    setIsSaving(true);
    try {
      await api.updateProfile({
        displayName: trimmed,
        bio: bio.trim(),
        termOrYear: currentTerm.trim(),
        locationCity: locationCity.trim(),
        locationState: locationState.trim(),
        intention: intention.trim(),
        interests: selectedInterests,
        promptAnswers:
          selectedPromptId && promptAnswer.trim()
            ? [{ promptId: selectedPromptId, answerText: promptAnswer.trim() }]
            : [],
      });
      await Promise.all([refreshUser(), hydrateProfile()]);
      setSaveFeedback('Profile changes saved cleanly.');
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError(null);
    setSaveFeedback(null);

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      setSaveError('Choose a JPEG, PNG, WebP, or HEIC portrait photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSaveError('Portrait size must stay under 10 MB.');
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
      await hydrateProfile();
      setSaveFeedback('Portrait uploaded securely to private storage.');
    } catch (err: any) {
      setSaveError(err.message || 'Portrait upload failed.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setSaveError(null);
    try {
      await api.removePhoto(photoId);
      await hydrateProfile();
      setSaveFeedback('Portrait removed.');
    } catch (err: any) {
      setSaveError(err.message || 'Could not remove portrait.');
    }
  };

  const handleSetPrimaryPhoto = async (photoId: string) => {
    setSaveError(null);
    try {
      await api.setPrimaryPhoto(photoId);
      await hydrateProfile();
      setSaveFeedback('Primary portrait updated.');
    } catch (err: any) {
      setSaveError(err.message || 'Could not update primary portrait.');
    }
  };

  const handleToggleDiscovery = async () => {
    setSaveError(null);
    setSaveFeedback(null);
    setIsTogglingDiscovery(true);
    try {
      const nextPublish = isDiscoveryPaused;
      await api.togglePublish(nextPublish);
      await hydrateProfile();
      setSaveFeedback(
        nextPublish ? 'Profile is now live in Discover.' : 'Discovery visibility paused cleanly.',
      );
    } catch (err: any) {
      setSaveError(err.message || 'Unable to change Discover visibility.');
    } finally {
      setIsTogglingDiscovery(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setSaveError(null);
    setSaveFeedback(null);
    setIsRevokingOthers(true);
    try {
      const res = await api.revokeOtherSessions();
      setSaveFeedback(`${res.message} (${res.revokedCount} terminated).`);
    } catch (err: any) {
      setSaveError(err.message || 'Unable to revoke other sessions.');
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const maskedEmail = user?.email
    ? `${user.email.slice(0, 3)}*****@${user.email.split('@')[1]}`
    : 'Protected';
  const pathwayLabel = user?.eligibility?.pathwayCode
    ? `${String(user.eligibility.pathwayCode).toUpperCase()} Pathway`
    : 'Verified Active Enrolment';
  const selectedProgrammeLabel =
    PROGRAMME_LABELS[programmeFamily] || 'BS in Data Science and Applications';

  const previewName = sanitizeDisplayName(displayName);
  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0] || null;
  const activePromptObj = catalogPrompts.find((p) => p.id === selectedPromptId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-ui">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-iris">
            STUDENT PROFILE · PHASE 1
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-chalk m-0">
          Profile &amp; Account Settings
        </h1>
        <p className="text-sm text-silver mt-1.5 max-w-2xl leading-relaxed">
          Manage your Discover presence, private portrait gallery, and verification settings.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Profile Sections"
        className="flex items-center gap-2 border-b border-edge mb-8 overflow-x-auto"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'public'}
          onClick={() => setActiveTab('public')}
          className={`h-11 px-4 inline-flex items-center gap-2 text-sm font-medium transition-colors select-none ${
            activeTab === 'public'
              ? 'text-chalk border-b-2 border-iris font-semibold'
              : 'text-ash hover:text-silver'
          }`}
        >
          <UserIcon
            size={16}
            color={activeTab === 'public' ? 'var(--smn-accent-iris, #8580C4)' : 'currentColor'}
          />
          <span>Public Profile &amp; Discovery Card</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'private'}
          onClick={() => setActiveTab('private')}
          className={`h-11 px-4 inline-flex items-center gap-2 text-sm font-medium transition-colors select-none ${
            activeTab === 'private'
              ? 'text-chalk border-b-2 border-iris font-semibold'
              : 'text-ash hover:text-silver'
          }`}
        >
          <LockIcon
            size={16}
            color={activeTab === 'private' ? 'var(--smn-accent-iris, #8580C4)' : 'currentColor'}
          />
          <span>Confidential Verification &amp; Privacy</span>
        </button>
      </div>

      {saveFeedback && (
        <div
          role="status"
          className="p-3.5 mb-6 bg-[#10241A] border border-success/40 text-success rounded-[6px] text-sm font-medium text-center"
        >
          {saveFeedback}
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="p-3.5 mb-6 bg-[#2E1417] border border-danger/40 text-danger rounded-[6px] text-sm font-medium text-center"
        >
          {saveError}
        </div>
      )}

      {activeTab === 'public' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleSave} className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-7 flex flex-col gap-5">
              <h2 className="text-lg font-semibold text-chalk m-0 tracking-tight">
                Essential Profile Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Public Display Name"
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Ananya"
                  helperText="Institutional roll numbers and emails are strictly prohibited."
                  required
                />

                <div>
                  <label className="text-xs font-medium text-silver block mb-1.5">
                    Age Eligibility Status
                  </label>
                  <div className="w-full h-12 bg-iron text-silver rounded-[4px] border border-edge/60 px-3.5 flex items-center justify-between text-sm">
                    <span>
                      {user?.eligibility?.ageStatus === 'approved'
                        ? '18+ Verified Adult'
                        : 'Pending Verification'}
                    </span>
                    <Badge variant="verified" size="sm">Verified</Badge>
                  </div>
                  <p className="text-xs text-ash mt-1.5">
                    Verified during onboarding; exact birth dates are never shown publicly.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">
                  Academic Programme Track (Verified)
                </label>
                <div className="w-full h-12 bg-iron text-chalk rounded-[4px] border border-edge/60 px-3.5 flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{selectedProgrammeLabel}</span>
                  <Badge variant="programme" size="sm">Verified Track</Badge>
                </div>
                <p className="text-xs text-ash mt-1.5">
                  Approved Phase 1 IIT Madras non-campus BS programme family.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Academic Level / Term"
                  id="currentTerm"
                  type="text"
                  value={currentTerm}
                  onChange={(e) => setCurrentTerm(e.target.value)}
                  placeholder="e.g. Diploma Level"
                />
                <Input
                  label="City (Coarse)"
                  id="locationCity"
                  type="text"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                />
                <Input
                  label="State"
                  id="locationState"
                  type="text"
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                  placeholder="e.g. Karnataka"
                />
              </div>

              <Input
                label="Relationship Intention"
                id="intention"
                type="text"
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="e.g. Long-term intentional relationship"
              />
            </div>

            {/* Private R2 Portrait Gallery */}
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-7 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-chalk m-0 tracking-tight">
                    Private Portrait Gallery
                  </h2>
                  <p className="text-xs text-silver mt-1">
                    Portraits live in private R2 storage with short-lived signed access. At least
                    1 portrait is required to stay live in Discover.
                  </p>
                </div>
                <label className="inline-flex items-center px-3.5 py-2 rounded-[6px] bg-iris text-stage text-xs font-semibold cursor-pointer hover:bg-iris-hover">
                  <span>{isUploadingPhoto ? 'Uploading...' : '+ Upload Portrait'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="sr-only"
                  />
                </label>
              </div>

              {photos.length === 0 ? (
                <p className="text-xs text-warning">
                  No portraits attached yet. Upload a portrait photo to remain discoverable.
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
                            alt="Member portrait preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[11px] text-ash px-2 text-center">
                            Private R2 Image Attached
                          </span>
                        )}
                      </div>
                      <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                        {photo.isPrimary ? (
                          <span className="text-iris font-semibold">Primary</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryPhoto(photo.id)}
                            className="text-silver hover:text-chalk underline"
                          >
                            Set primary
                          </button>
                        )}
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

            {/* Bio & Interests */}
            <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-7 flex flex-col gap-5">
              <h2 className="text-lg font-semibold text-chalk m-0 tracking-tight">
                Bio &amp; Intellectual Passions
              </h2>

              <div>
                <label htmlFor="bioText" className="text-xs font-medium text-silver block mb-1.5">
                  Personal Biography (Max 500 characters)
                </label>
                <textarea
                  id="bioText"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 500))}
                  rows={4}
                  placeholder="Share your intellectual rhythm, remote study habits, or offline interests..."
                  className="w-full min-h-[110px] p-3.5 bg-iron text-chalk rounded-[4px] border border-edge text-sm outline-none focus:border-iris"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-silver font-mono">{500 - bio.length} left</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-silver block mb-2">
                  Interests ({selectedInterests.length}/5 selected)
                </span>
                <div className="flex flex-wrap gap-2">
                  {catalogInterests.map((item) => {
                    const active = selectedInterests.includes(item.name);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleInterest(item.name)}
                        className={`text-xs px-2.5 py-1.5 rounded-[4px] border transition-colors ${
                          active
                            ? 'bg-[#1C1C2E] text-iris border-iris font-semibold'
                            : 'bg-iron text-silver border-edge hover:border-[#4B5665]'
                        }`}
                      >
                        {item.name} {active && '✓'}
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

              <select
                aria-label="Prompt Question"
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-full h-12 bg-iron text-chalk rounded-[4px] border border-edge px-3.5 text-sm outline-none"
              >
                {catalogPrompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.promptText}
                  </option>
                ))}
              </select>

              <textarea
                aria-label="Prompt Answer"
                value={promptAnswer}
                onChange={(e) => setPromptAnswer(e.target.value.slice(0, 250))}
                rows={2}
                placeholder="Write a concise prompt response..."
                className="w-full min-h-[72px] p-3.5 bg-iron text-chalk rounded-[4px] border border-edge text-sm outline-none focus:border-iris"
              />
            </div>

            <div>
              <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
                Save Profile Changes
              </Button>
            </div>
          </form>

          {/* Live Preview Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ash">
                LIVE PREVIEW · HOW PEERS SEE YOU
              </span>
              <Badge variant="verified" size="sm">Verified View</Badge>
            </div>

            <div className="bg-coal border border-edge rounded-[12px] overflow-hidden shadow-xl">
              <div className="h-96 relative bg-iron overflow-hidden flex items-center justify-center">
                {primaryPhoto?.photoUrl && !imageLoadFailed ? (
                  <img
                    src={primaryPhoto.photoUrl}
                    alt={`${previewName || 'Member'} portrait`}
                    onError={() => setImageLoadFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-coal p-6 text-center">
                    <div className="w-20 h-20 rounded-[8px] bg-slate border border-edge flex items-center justify-center text-chalk text-2xl font-bold mb-3">
                      {previewName ? previewName.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <span className="text-xs text-silver font-medium">
                      Upload a portrait photo to display here
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-stage/95 via-stage/35 to-transparent pointer-events-none" />

                <div className="absolute bottom-4 left-5 right-5 text-chalk">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="verified" size="sm">Verified</Badge>
                    {locationCity && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] bg-coal/85 text-silver border border-edge">
                        <PinIcon size={11} color="currentColor" />
                        <span>{locationCity}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-chalk m-0">
                    {previewName || 'Set your display name'}
                  </h3>
                  <p className="m-0 text-xs font-medium text-silver/90 mt-1">
                    {selectedProgrammeLabel}
                    {currentTerm ? ` · ${currentTerm}` : ''}
                  </p>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-4">
                <p className="text-sm text-silver leading-relaxed m-0">
                  {bio || <span className="italic text-ash">No personal biography saved yet.</span>}
                </p>

                {selectedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInterests.map((interest) => (
                      <Badge key={interest} variant="neutral" size="sm">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                )}

                {promptAnswer && activePromptObj && (
                  <div className="p-3.5 bg-iron border-l-2 border-iris rounded-r-[6px]">
                    <span className="text-[11px] font-semibold text-iris uppercase tracking-wide block mb-1">
                      {activePromptObj.promptText}
                    </span>
                    <p className="text-xs text-silver m-0 italic">&ldquo;{promptAnswer}&rdquo;</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-coal border border-edge/80 rounded-[8px] flex items-start gap-2.5">
              <InfoIcon size={16} color="var(--smn-accent-iris, #8580C4)" className="shrink-0 mt-0.5" />
              <p className="m-0 text-xs text-silver leading-relaxed">
                Your institutional email, verification case history, and exact birth date are never
                exposed to prospective matches.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'private' && (
        <div className="flex flex-col gap-6 max-w-2xl">
          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8">
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-iris">
                <ShieldIcon size={22} color="currentColor" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-chalk m-0">
                  Student Verification Status
                </h2>
                <p className="m-0 text-xs text-silver mt-0.5">
                  Separated verification metadata isolated from public Discover cards.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 bg-iron/70 p-5 rounded-[8px] border border-edge/80 mb-6 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-silver">Enrolment Status:</span>
                <Badge variant="verified" size="sm">Verified BS Cohort</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-silver">Programme Family:</span>
                <span className="font-semibold text-chalk">{selectedProgrammeLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-silver">Academic Pathway:</span>
                <span className="font-semibold text-chalk">{pathwayLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-silver">Masked Institutional Email:</span>
                <span className="font-semibold text-chalk font-mono">{maskedEmail}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-silver">Adult Eligibility:</span>
                <span className="font-semibold text-success">18+ Approved</span>
              </div>
            </div>

            <p className="m-0 text-xs text-ash leading-relaxed">
              Independent community product. SayMyName.in is not owned, operated, or endorsed by
              IIT Madras.
            </p>
          </div>

          <div className="bg-coal border border-edge rounded-[12px] p-6 sm:p-8 space-y-5">
            <h2 className="text-lg font-semibold text-chalk m-0">
              Discovery &amp; Session Controls
            </h2>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-edge">
              <div>
                <h3 className="text-sm font-semibold text-chalk m-0 mb-1">Pause Discovery</h3>
                <p className="m-0 text-xs text-silver max-w-md leading-relaxed">
                  Hide your profile from new Discover batches while keeping active mutual matches and
                  conversations intact.
                </p>
              </div>
              <Button
                type="button"
                variant={isDiscoveryPaused ? 'warm' : 'secondary'}
                size="sm"
                isLoading={isTogglingDiscovery}
                onClick={handleToggleDiscovery}
              >
                {isDiscoveryPaused ? 'Resume Discovery' : 'Pause Discovery'}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-semibold text-chalk m-0 mb-1">
                  Active Device Sessions
                </h3>
                <p className="m-0 text-xs text-silver max-w-md leading-relaxed">
                  Revoke refresh sessions on all other browsers or devices while keeping your
                  current session signed in.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={isRevokingOthers}
                onClick={handleRevokeOtherSessions}
              >
                Sign Out Other Sessions
              </Button>
            </div>
          </div>

          <div className="bg-coal border border-edge rounded-[12px] p-6 flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/safety" className="w-full sm:w-1/2">
              <Button variant="secondary" size="md" className="w-full">
                Safety Commitments
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="md"
              onClick={() => logout()}
              className="w-full sm:w-1/2"
            >
              Sign Out of This Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
