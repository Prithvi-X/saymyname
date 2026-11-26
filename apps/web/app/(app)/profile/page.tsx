'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { isPrivateIdentifierLike } from '@saymyname/validation';
import { useAuth } from '../../../lib/auth-context';
import { api, sanitizeDisplayName } from '../../../lib/api';
import { Button, Input, Badge, Dialog, Tabs } from '../../../components/ui';
import {
  ShieldIcon,
  LockIcon,
  PinIcon,
  UserIcon,
  CheckIcon,
  CompassIcon,
  XIcon,
} from '../../../components/icons';

const PROGRAMME_LABELS: Record<string, string> = {
  data_science_applications: 'BS in Data Science and Applications',
  electronic_systems: 'BS in Electronic Systems',
  aeronautics_space: 'BS in Aeronautics and Space Technology',
  management_data_science: 'BS in Management and Data Science',
};

type ProfileTab = 'overview' | 'edit' | 'photos' | 'preferences' | 'visibility' | 'account';

interface PhotoItem {
  id: string;
  photoUrl: string | null;
  displayOrder: number;
  isPrimary: boolean;
  mimeType?: string | null;
}

interface InterestItem {
  id: string;
  name: string;
  category?: string;
}

interface PromptItem {
  id: string;
  promptText: string;
  category?: string;
}

interface PromptAnswerEntry {
  id?: string;
  promptId: string;
  promptText?: string;
  answerText: string;
}

interface DatingPreferencesState {
  minAge: number;
  maxAge: number;
  allowedProgrammes: string[];
  maxDistanceKm: number | null;
  showInDiscovery: boolean;
}

interface PublicPreviewData {
  id: string;
  displayName: string;
  age?: number | null;
  programmeFamily: string;
  termOrYear?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  intention?: string | null;
  bio?: string | null;
  photos: { id: string; photoUrl: string | null; displayOrder: number; isPrimary: boolean }[];
  interests: string[];
  promptAnswers: { id: string; promptId: string; promptText: string; answerText: string }[];
  isVerified: boolean;
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Form Fields
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
  const [ageDisplayMode, setAgeDisplayMode] = useState<'hidden' | 'show_calculated_age'>('show_calculated_age');

  // Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [supportedImageMimes, setSupportedImageMimes] = useState<string[]>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ]);

  // Interests & Prompts Catalogs
  const [catalogInterests, setCatalogInterests] = useState<InterestItem[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [catalogPrompts, setCatalogPrompts] = useState<PromptItem[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswerEntry[]>([]);

  // Dating Preferences (Private)
  const [preferences, setPreferences] = useState<DatingPreferencesState>({
    minAge: 18,
    maxAge: 35,
    allowedProgrammes: [
      'data_science_applications',
      'electronic_systems',
      'aeronautics_space',
      'management_data_science',
    ],
    maxDistanceKm: null,
    showInDiscovery: true,
  });

  // Publication State
  const [isPublished, setIsPublished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Public Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PublicPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTogglingDiscovery, setIsTogglingDiscovery] = useState(false);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  const hydrateProfile = useCallback(async () => {
    try {
      const [profile, catalog, prefs] = await Promise.all([
        api.getProfile(),
        api
          .getProfileCatalog()
          .catch(() => ({ interests: [], prompts: [], supportedImageMimes: undefined })),
        api.getPreferences().catch(() => null),
      ]);

      setCatalogInterests(catalog.interests || []);
      setCatalogPrompts(catalog.prompts || []);
      if (Array.isArray(catalog.supportedImageMimes) && catalog.supportedImageMimes.length > 0) {
        setSupportedImageMimes(catalog.supportedImageMimes);
      }

      const clean = sanitizeDisplayName(profile.displayName);
      if (clean && clean !== 'Member') setDisplayName(clean);
      if (profile.programmeFamily) setProgrammeFamily(profile.programmeFamily);
      if (profile.termOrYear) setCurrentTerm(profile.termOrYear);
      if (profile.locationCity) setLocationCity(profile.locationCity);
      if (profile.locationState) setLocationState(profile.locationState);
      if (profile.intention) setIntention(profile.intention);
      if (profile.bio) setBio(profile.bio);
      if (profile.ageDisplayMode === 'hidden' || profile.ageDisplayMode === 'show_calculated_age') {
        setAgeDisplayMode(profile.ageDisplayMode);
      }
      setIsPublished(Boolean(profile.isPublished));
      setIsPaused(Boolean(profile.isPaused));
      setPhotos(profile.photos || []);

      if (Array.isArray(profile.interests)) {
        setSelectedInterests(
          profile.interests.map((i: any) => (typeof i === 'string' ? i : i.interest?.name || i.name)),
        );
      }

      if (Array.isArray(profile.promptAnswers)) {
        setPromptAnswers(
          profile.promptAnswers.map((pa: any) => ({
            id: pa.id,
            promptId: pa.promptId,
            promptText: pa.prompt?.promptText || pa.promptText || '',
            answerText: pa.answerText,
          })),
        );
      }

      if (prefs) {
        setPreferences({
          minAge: typeof prefs.minAge === 'number' ? prefs.minAge : 18,
          maxAge: typeof prefs.maxAge === 'number' ? prefs.maxAge : 35,
          allowedProgrammes: Array.isArray(prefs.allowedProgrammes)
            ? prefs.allowedProgrammes
            : [
                'data_science_applications',
                'electronic_systems',
                'aeronautics_space',
                'management_data_science',
              ],
          maxDistanceKm: prefs.maxDistanceKm ?? null,
          showInDiscovery: prefs.showInDiscovery !== false,
        });
      }
    } catch {
      // Handled silently
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      hydrateProfile();
    }
  }, [user?.id, hydrateProfile]);

  // Completion calculation
  const completionReport = useMemo(() => {
    const checks = [
      { key: 'name', label: 'Authentic display name', done: Boolean(displayName && displayName !== 'Member') },
      { key: 'bio', label: 'Personal bio (at least 20 chars)', done: Boolean(bio && bio.trim().length >= 20) },
      { key: 'location', label: 'City & State coarse location', done: Boolean(locationCity && locationState) },
      { key: 'photo', label: 'At least 1 portrait photograph', done: photos.length > 0 },
      { key: 'interests', label: 'At least 3 personal interests', done: selectedInterests.length >= 3 },
      { key: 'prompts', label: 'At least 1 conversation prompt', done: promptAnswers.length >= 1 },
      {
        key: 'verification',
        label: '18+ and IITM BS Student verification',
        done: Boolean(
          user?.eligibility?.ageStatus === 'approved' &&
            user?.eligibility?.studentStatus === 'approved',
        ),
      },
    ];
    const completedCount = checks.filter((c) => c.done).length;
    const percentage = Math.round((completedCount / checks.length) * 100);
    return { checks, completedCount, total: checks.length, percentage };
  }, [displayName, bio, locationCity, locationState, photos, selectedInterests, promptAnswers, user?.eligibility]);

  const toggleInterest = (interestName: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interestName)) {
        return prev.filter((i) => i !== interestName);
      }
      if (prev.length >= 10) {
        setSaveError('Maximum of 10 personal interests can be selected.');
        return prev;
      }
      setSaveError(null);
      return [...prev, interestName];
    });
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setSaveFeedback(null);

    const trimmed = displayName.trim();
    if (!trimmed || isPrivateIdentifierLike(trimmed)) {
      setSaveError('Display name must be valid text and cannot contain roll numbers, emails, or account IDs.');
      return;
    }

    if (bio.length > 500) {
      setSaveError('Biography cannot exceed 500 characters.');
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
        ageDisplayMode,
        interests: selectedInterests,
        promptAnswers: promptAnswers
          .filter((pa) => pa.answerText.trim().length > 0)
          .map((pa) => ({
            promptId: pa.promptId,
            promptText: pa.promptText,
            answerText: pa.answerText.trim(),
          })),
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

  const handleSavePreferences = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setSaveFeedback(null);

    if (preferences.minAge < 18) {
      setSaveError('Minimum age preference cannot be below the 18+ adult boundary.');
      return;
    }
    if (preferences.minAge > preferences.maxAge) {
      setSaveError('Minimum age cannot be greater than maximum age.');
      return;
    }

    setIsSaving(true);
    try {
      await api.updatePreferences(preferences);
      setSaveFeedback('Private dating preferences saved cleanly.');
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError(null);
    setSaveFeedback(null);

    if (!supportedImageMimes.includes(file.type.toLowerCase())) {
      const labels = supportedImageMimes
        .map((m) => m.replace('image/', '').toUpperCase())
        .join(', ');
      setSaveError(`Unsupported photo format. Allowed: ${labels}.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSaveError('Portrait file size exceeds 10 MB limit.');
      return;
    }
    if (photos.length >= 6) {
      setSaveError('Maximum of 6 portrait photographs allowed per profile.');
      return;
    }

    setIsUploadingPhoto(true);
    setUploadProgress(15);
    try {
      const presign = await api.presignPhoto({
        filename: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
      });
      setUploadProgress(45);

      if (presign.uploadUrl) {
        await api.uploadToPresignedUrl(presign.uploadUrl, file);
      }
      setUploadProgress(80);

      await api.addPhoto({
        s3Key: presign.s3Key,
        mimeType: file.type,
        isPrimary: photos.length === 0,
      });
      setUploadProgress(100);

      await hydrateProfile();
      setSaveFeedback('Portrait photograph securely stored in private R2 vault.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Portrait upload failed.');
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleSetPrimaryPhoto = async (photoId: string) => {
    setSaveError(null);
    try {
      await api.setPrimaryPhoto(photoId);
      await hydrateProfile();
      setSaveFeedback('Primary portrait updated.');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Could not update primary portrait.');
    }
  };

  const handleMovePhoto = async (index: number, direction: 'left' | 'right') => {
    if (
      (direction === 'left' && index === 0) ||
      (direction === 'right' && index === photos.length - 1)
    ) {
      return;
    }
    const newPhotos = [...photos];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[targetIndex];
    newPhotos[targetIndex] = temp;

    setPhotos(newPhotos);
    try {
      await api.reorderPhotos(newPhotos.map((p) => p.id));
      await hydrateProfile();
      setSaveFeedback('Photograph order updated.');
      setTimeout(() => setSaveFeedback(null), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Could not reorder photographs.');
      await hydrateProfile();
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setSaveError(null);
    try {
      await api.removePhoto(photoId);
      await hydrateProfile();
      setSaveFeedback('Photograph removed.');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Could not remove photograph.');
    }
  };

  const handleTogglePublish = async (nextState: boolean) => {
    setSaveError(null);
    setSaveFeedback(null);
    setIsTogglingDiscovery(true);
    try {
      if (nextState) {
        await api.publishProfile({
          isPublished: true,
          acceptGuidelinesConsent: true,
        });
        setSaveFeedback('Your profile is now live in Discovery!');
      } else {
        await api.togglePublish(false);
        setSaveFeedback('Discovery visibility paused. Active matches and conversations remain intact.');
      }
      await hydrateProfile();
    } catch (err: any) {
      setSaveError(err.message || 'Could not update visibility state.');
    } finally {
      setIsTogglingDiscovery(false);
    }
  };

  const handleOpenPreview = async () => {
    setIsLoadingPreview(true);
    setSaveError(null);
    try {
      const data = await api.getProfilePreview();
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (err: any) {
      setSaveError(err.message || 'Could not load public profile preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setIsRevokingOthers(true);
    setSaveFeedback(null);
    setSaveError(null);
    try {
      await api.revokeOtherSessions();
      setSaveFeedback('All other active sessions have been safely signed out.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Could not revoke other sessions.');
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0];
  const coarseLocationPreview = [locationCity.trim(), locationState.trim()]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="container-app pt-5 pb-24 sm:pt-7 md:pb-12 flex flex-col gap-6 font-ui text-chalk">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-edge pb-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-[8px] overflow-hidden bg-iron border border-edge flex items-center justify-center shrink-0">
            {primaryPhoto?.photoUrl ? (
              <img
                src={primaryPhoto.photoUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-iris">
                {displayName.charAt(0).toUpperCase() || 'M'}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {user?.eligibility?.ageStatus === 'approved' && user?.eligibility?.studentStatus === 'approved' && (
                <Badge variant="verified" size="sm">
                  Verified
                </Badge>
              )}
              <Badge
                variant={isPublished && !isPaused ? 'verified' : isPaused ? 'warning' : 'neutral'}
                size="sm"
              >
                {isPublished && !isPaused
                  ? 'Live in Discover'
                  : isPaused
                    ? 'Discovery Paused'
                    : 'Private Draft'}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-[1.85rem] font-semibold text-chalk tracking-[-0.02em] truncate">
              {displayName || 'Member'}
            </h1>
            <p className="text-[13px] sm:text-sm text-silver mt-0.5 truncate">
              {PROGRAMME_LABELS[programmeFamily] || 'IITM BS Degree'} · {currentTerm}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenPreview}
            disabled={isLoadingPreview}
            leftIcon={<CompassIcon size={15} />}
          >
            {isLoadingPreview ? 'Loading...' : 'Peer Preview'}
          </Button>

          {isPublished && !isPaused ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleTogglePublish(false)}
              disabled={isTogglingDiscovery}
              className="!border-warning/50 !text-warning hover:!bg-warning/10"
            >
              {isTogglingDiscovery ? 'Pausing...' : 'Pause Discovery'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleTogglePublish(true)}
              disabled={isTogglingDiscovery || completionReport.percentage < 70}
            >
              {isTogglingDiscovery ? 'Publishing...' : 'Publish to Discover'}
            </Button>
          )}
        </div>
      </header>

      {/* Architectural Section Navigation Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as ProfileTab)}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'edit', label: 'Edit Profile' },
          { id: 'photos', label: 'Photos', badge: photos.length },
          { id: 'preferences', label: 'Preferences' },
          { id: 'visibility', label: 'Visibility' },
          { id: 'account', label: 'Account & Security' },
        ]}
      />

      {/* Global Feedback Banner */}
      {saveFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-[8px] bg-coal border border-success/40 text-success text-sm flex items-center gap-2.5"
        >
          <CheckIcon size={17} />
          <span>{saveFeedback}</span>
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-danger text-sm flex items-center gap-2.5"
        >
          <XIcon size={17} />
          <span>{saveError}</span>
        </div>
      )}

      {/* 12-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Active Section (8 Cols Desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
          {/* TAB 1: OVERVIEW & COMPLETION (Flat Hairline Surface) */}
          {activeTab === 'overview' && (
            <div className="rounded-[12px] border border-edge bg-coal divide-y divide-edge overflow-hidden">
              {/* Readiness & Verification Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-edge">
                <div className="p-6 flex flex-col justify-between gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-medium text-iris">
                        Profile readiness
                      </span>
                      <span className="text-sm font-semibold text-chalk tabular-nums">
                        {completionReport.percentage}% Complete
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-[4px] bg-stage overflow-hidden mb-4">
                      <div
                        className="h-full bg-iris transition-all duration-300"
                        style={{ width: `${completionReport.percentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-silver leading-relaxed">
                      Complete your public card and private filters before publishing to verified peers.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-silver">
                      Status:{' '}
                      <strong className="text-chalk">
                        {isPublished && !isPaused
                          ? 'Live in Discover'
                          : isPaused
                            ? 'Paused'
                            : 'Draft (Private)'}
                      </strong>
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => setActiveTab('edit')}>
                      Edit Public Card
                    </Button>
                  </div>
                </div>

                <div className="p-6 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-iris">
                      <ShieldIcon size={17} />
                      <span className="text-[13px] font-medium">
                        Verified cohort status
                      </span>
                    </div>
                    <ul className="space-y-3 text-[13px] text-silver">
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} color="#77C5A1" className="shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-chalk block">18+ Adult Boundary</strong>
                          <span className="text-xs text-silver/80">
                            Verified via date of birth and manual review
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} color="#77C5A1" className="shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-chalk block">IIT Madras BS Enrolment</strong>
                          <span className="text-xs text-silver/80">
                            {PROGRAMME_LABELS[programmeFamily]}
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} color="#77C5A1" className="shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-chalk block">Student privacy isolation</strong>
                          <span className="text-xs text-silver/80">
                            Roll numbers and exact DOB stay off public cards
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-edge text-xs text-silver/75">
                    Independent platform. Not owned or endorsed by IIT Madras.
                  </div>
                </div>
              </div>

              {/* Discovery Readiness Checklist */}
              <div className="p-6">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-base font-semibold text-chalk">
                    Discovery Readiness Checklist
                  </h2>
                  <span className="text-[13px] text-silver/80 tabular-nums">
                    {completionReport.completedCount} of {completionReport.total} complete
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {completionReport.checks.map((item) => (
                    <div
                      key={item.key}
                      className={`px-3.5 py-3 rounded-[8px] border text-[13px] flex items-center justify-between gap-3 ${
                        item.done
                          ? 'bg-iron border-edge text-chalk'
                          : 'bg-stage border-edge text-silver'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.done ? (
                        <CheckIcon size={15} color="#77C5A1" />
                      ) : (
                        <span className="text-xs text-warning font-medium shrink-0">
                          Required
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE (Unified Hairline Surface + 48px Controls) */}
          {activeTab === 'edit' && (
            <form
              onSubmit={handleSaveProfile}
              className="rounded-[12px] border border-edge bg-coal divide-y divide-edge overflow-hidden"
            >
              <div className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-edge">
                  <h2 className="text-lg font-semibold text-chalk">
                    Public Identity &amp; Academics
                  </h2>
                  <Badge variant="neutral" size="sm">
                    Visible in Discover
                  </Badge>
                </div>

                <div>
                  <label htmlFor="profile-display-name" className="block text-[13px] font-medium text-silver mb-1.5">
                    Preferred Display Name
                  </label>
                  <Input
                    id="profile-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Ananya"
                    maxLength={50}
                    required
                    helperText="How peers address you. Roll numbers, account IDs, or email addresses are prohibited."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="profile-track-locked" className="block text-[13px] font-medium text-silver mb-1.5">
                      Verified Academic Programme
                    </label>
                    <input
                      id="profile-track-locked"
                      type="text"
                      value={PROGRAMME_LABELS[programmeFamily] || programmeFamily}
                      disabled
                      className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-silver cursor-not-allowed"
                    />
                    <p className="text-xs text-silver/75 mt-1.5">
                      Locked to verified institutional record.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="profile-term-select" className="block text-[13px] font-medium text-silver mb-1.5">
                      Current Study Level / Term
                    </label>
                    <select
                      id="profile-term-select"
                      value={currentTerm}
                      onChange={(e) => setCurrentTerm(e.target.value)}
                      className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris"
                    >
                      <option value="Foundation Level">Foundation Level</option>
                      <option value="Diploma in Programming">Diploma in Programming</option>
                      <option value="Diploma in Data Science">Diploma in Data Science</option>
                      <option value="BSc Degree Level">BSc Degree Level</option>
                      <option value="BS Degree Level">BS Degree Level</option>
                      <option value="Final Term / Capstone">Final Term / Capstone</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="profile-city" className="block text-[13px] font-medium text-silver mb-1.5">
                      City (Coarse)
                    </label>
                    <Input
                      id="profile-city"
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      maxLength={60}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-state" className="block text-[13px] font-medium text-silver mb-1.5">
                      State
                    </label>
                    <Input
                      id="profile-state"
                      type="text"
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      maxLength={60}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-age-mode" className="block text-[13px] font-medium text-silver mb-1.5">
                      Age Display
                    </label>
                    <select
                      id="profile-age-mode"
                      value={ageDisplayMode}
                      onChange={(e) => setAgeDisplayMode(e.target.value as any)}
                      className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris"
                    >
                      <option value="show_calculated_age">Display verified age</option>
                      <option value="hidden">Hide age on profile</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-intention" className="block text-[13px] font-medium text-silver mb-1.5">
                    Looking For / Intention
                  </label>
                  <select
                    id="profile-intention"
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris"
                  >
                    <option value="Long-term intentional relationship">
                      Long-term intentional relationship
                    </option>
                    <option value="Intentional dating & deep connection">
                      Intentional dating &amp; deep connection
                    </option>
                    <option value="Thoughtful companionship across distance">
                      Thoughtful companionship across distance
                    </option>
                    <option value="Getting to know each other over study sessions">
                      Getting to know each other over study sessions
                    </option>
                  </select>
                </div>
              </div>

              {/* Biography */}
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="profile-bio-textarea" className="text-base font-semibold text-chalk">
                    Biography
                  </label>
                  <span
                    className={`text-xs tabular-nums ${
                      bio.length > 480 ? 'text-warning' : 'text-silver/75'
                    }`}
                  >
                    {bio.length}/500
                  </span>
                </div>
                <textarea
                  id="profile-bio-textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={5}
                  placeholder="Share your interests, ideas that excite you, and the kind of connection you are looking for..."
                  className="w-full p-4 rounded-[8px] bg-stage border border-edge text-sm text-chalk leading-relaxed focus-visible:outline-2 focus-visible:outline-iris resize-none transition-colors"
                />
                <p className="text-xs text-silver/75">
                  Minimum 20 characters recommended for Discovery publication.
                </p>
              </div>

              {/* Curated Interests */}
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-chalk">
                      Personal Passions &amp; Interests
                    </h2>
                    <p className="text-[13px] text-silver mt-0.5">
                      Select 3 to 10 interests that reflect your pursuits.
                    </p>
                  </div>
                  <span className="text-xs text-iris font-medium tabular-nums">
                    {selectedInterests.length}/10 selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {catalogInterests.map((interest) => {
                    const isSelected = selectedInterests.includes(interest.name);
                    return (
                      <button
                        key={interest.id}
                        type="button"
                        onClick={() => toggleInterest(interest.name)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors focus-visible:outline-2 focus-visible:outline-iris ${
                          isSelected
                            ? 'bg-[#1C1C2E] border-iris text-chalk'
                            : 'bg-iron border-edge text-silver hover:border-[#465261] hover:text-chalk'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {interest.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conversation Prompts */}
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold text-chalk">Conversation Prompts</h2>
                  <p className="text-[13px] text-silver mt-0.5">
                    Answer up to 3 prompts to spark genuine conversations.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  {promptAnswers.map((item, idx) => (
                    <div
                      key={item.promptId || idx}
                      className="p-4 rounded-[8px] bg-iron border border-edge flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-iris font-medium">
                          {item.promptText || 'Conversation Prompt'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPromptAnswers((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-xs font-medium text-danger hover:underline py-1 px-2"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={item.answerText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPromptAnswers((prev) =>
                            prev.map((pa, i) => (i === idx ? { ...pa, answerText: val } : pa)),
                          );
                        }}
                        maxLength={250}
                        rows={3}
                        placeholder="Your thoughtful response..."
                        className="w-full p-3.5 rounded-[6px] bg-coal border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris resize-none"
                      />
                      <div className="text-right text-xs text-silver/75 tabular-nums">
                        {item.answerText.length}/250
                      </div>
                    </div>
                  ))}

                  {promptAnswers.length < 3 && (
                    <div>
                      <label htmlFor="add-prompt-select" className="block text-[13px] font-medium text-silver mb-1.5">
                        Add a prompt ({promptAnswers.length}/3)
                      </label>
                      <select
                        id="add-prompt-select"
                        onChange={(e) => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          const pObj = catalogPrompts.find((p) => p.id === targetId);
                          if (pObj && !promptAnswers.some((pa) => pa.promptId === targetId)) {
                            setPromptAnswers((prev) => [
                              ...prev,
                              { promptId: pObj.id, promptText: pObj.promptText, answerText: '' },
                            ]);
                          }
                          e.target.value = '';
                        }}
                        className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris"
                      >
                        <option value="">Select a prompt to answer...</option>
                        {catalogPrompts
                          .filter((cp) => !promptAnswers.some((pa) => pa.promptId === cp.id))
                          .map((cp) => (
                            <option key={cp.id} value={cp.id}>
                              {cp.promptText}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Save Action Bar */}
              <div className="px-6 py-4 bg-stage/50 flex flex-wrap items-center justify-between gap-3">
                <Button type="submit" variant="primary" size="md" disabled={isSaving} isLoading={isSaving}>
                  {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </Button>
                <Button type="button" variant="secondary" size="md" onClick={handleOpenPreview}>
                  Open Peer Preview
                </Button>
              </div>
            </form>
          )}

          {/* TAB 3: PHOTO MANAGEMENT (Asymmetric 6-Slot Vault Grid) */}
          {activeTab === 'photos' && (
            <div className="rounded-[12px] border border-edge bg-coal p-6 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-edge">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-chalk">
                    Portrait Media ({photos.length}/6)
                  </h2>
                  <p className="text-[13px] text-silver leading-relaxed max-w-xl">
                    Upload genuine portraits. Photos are stored privately with EXIF metadata removed before delivery.
                  </p>
                </div>

                {photos.length < 6 && (
                  <label className="cursor-pointer shrink-0">
                    <span className="min-h-[44px] px-5 rounded-[8px] bg-iris text-stage text-sm font-semibold hover:bg-[#9692D6] transition-colors inline-flex items-center gap-2">
                      {isUploadingPhoto ? 'Uploading...' : '+ Upload Portrait'}
                    </span>
                    <input
                      type="file"
                      accept={supportedImageMimes.join(',')}
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {uploadProgress !== null && (
                <div className="p-4 rounded-[8px] bg-iron border border-edge space-y-2">
                  <div className="flex justify-between text-[13px] text-iris">
                    <span>Uploading to private media storage...</span>
                    <span className="tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-[4px] bg-stage overflow-hidden">
                    <div
                      className="h-full bg-iris transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Asymmetric Primary + Secondary 6-Slot Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 auto-rows-fr">
                {photos.map((photo, index) => {
                  const isHeroSlot = index === 0;
                  return (
                    <div
                      key={photo.id}
                      className={`rounded-[10px] overflow-hidden bg-iron border border-edge flex flex-col ${
                        isHeroSlot ? 'col-span-2 row-span-2' : ''
                      }`}
                    >
                      <div className={`relative flex-1 bg-stage overflow-hidden ${isHeroSlot ? 'min-h-[260px] sm:min-h-[340px]' : 'aspect-[3/4]'}`}>
                        {photo.photoUrl ? (
                          <img
                            src={photo.photoUrl}
                            alt={`Portrait ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-silver/75 p-4 text-center">
                            <UserIcon size={28} />
                            <span className="text-xs mt-2">Private media slot</span>
                          </div>
                        )}

                        {photo.isPrimary && (
                          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-[4px] bg-iris text-stage text-xs font-semibold">
                            Primary
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 bg-iron border-t border-edge flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMovePhoto(index, 'left')}
                            disabled={index === 0}
                            aria-label="Move photo earlier"
                            title="Move left"
                            className="w-8 h-8 rounded-[4px] bg-stage text-silver hover:text-chalk disabled:opacity-30"
                          >
                            &larr;
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePhoto(index, 'right')}
                            disabled={index === photos.length - 1}
                            aria-label="Move photo later"
                            title="Move right"
                            className="w-8 h-8 rounded-[4px] bg-stage text-silver hover:text-chalk disabled:opacity-30"
                          >
                            &rarr;
                          </button>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {!photo.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryPhoto(photo.id)}
                              className="text-iris hover:underline font-medium py-1"
                            >
                              Make primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="text-danger hover:underline py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {Array.from({ length: Math.max(0, 6 - photos.length) }).map((_, i) => (
                  <label
                    key={`empty-${i}`}
                    className={`rounded-[10px] border border-dashed border-edge hover:border-iris flex flex-col items-center justify-center text-center p-4 cursor-pointer bg-stage/60 transition-colors group ${
                      photos.length === 0 && i === 0 ? 'col-span-2 row-span-2 min-h-[260px]' : 'aspect-[3/4]'
                    }`}
                  >
                    <span className="w-10 h-10 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-silver group-hover:text-iris mb-2 transition-colors">
                      +
                    </span>
                    <span className="text-[13px] text-silver group-hover:text-chalk font-medium">
                      Add Portrait {photos.length + i + 1}
                    </span>
                    <span className="text-xs text-silver/70 mt-1">JPEG, PNG, WebP · max 10MB</span>
                    <input
                      type="file"
                      accept={supportedImageMimes.join(',')}
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="hidden"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DATING PREFERENCES (CONFIDENTIAL) */}
          {activeTab === 'preferences' && (
            <form
              onSubmit={handleSavePreferences}
              className="rounded-[12px] border border-edge bg-coal divide-y divide-edge overflow-hidden"
            >
              <div className="p-5 bg-iron/70 flex items-start gap-3">
                <LockIcon size={18} color="#8580C4" className="shrink-0 mt-0.5" />
                <div className="text-[13px] text-silver leading-relaxed">
                  <strong className="text-chalk">Confidential discovery criteria:</strong> Filters guide reciprocal matching in Discover and never appear on your public profile card.
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-chalk">
                  Target Age Range
                </h2>
                <p className="text-[13px] text-silver">
                  Phase 1 is strictly restricted to verified adults aged 18 and above.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pref-min-age" className="block text-[13px] font-medium text-silver mb-1.5">
                      Minimum Age (18+)
                    </label>
                    <input
                      id="pref-min-age"
                      type="number"
                      min={18}
                      max={preferences.maxAge}
                      value={preferences.minAge}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          minAge: parseInt(e.target.value) || 18,
                        }))
                      }
                      className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris"
                    />
                  </div>
                  <div>
                    <label htmlFor="pref-max-age" className="block text-[13px] font-medium text-silver mb-1.5">
                      Maximum Age
                    </label>
                    <input
                      id="pref-max-age"
                      type="number"
                      min={preferences.minAge}
                      max={65}
                      value={preferences.maxAge}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          maxAge: parseInt(e.target.value) || 35,
                        }))
                      }
                      className="w-full px-3.5 h-12 rounded-[6px] bg-stage border border-edge text-sm text-chalk focus-visible:outline-2 focus-visible:outline-iris"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-chalk">
                  Approved IITM BS Programme Tracks
                </h2>
                <p className="text-[13px] text-silver">
                  Choose which of the four approved non-campus BS tracks you are open to discovering:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(PROGRAMME_LABELS).map(([code, label]) => {
                    const isChecked = preferences.allowedProgrammes.includes(code);
                    return (
                      <label
                        key={code}
                        className={`flex items-center gap-3 p-4 min-h-[52px] rounded-[8px] border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-slate border-iris text-chalk'
                            : 'bg-stage border-edge text-silver hover:bg-iron'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setPreferences((prev) => {
                              const next = isChecked
                                ? prev.allowedProgrammes.filter((c) => c !== code)
                                : [...prev.allowedProgrammes, code];
                              return { ...prev, allowedProgrammes: next };
                            });
                          }}
                          className="w-4 h-4 accent-iris shrink-0"
                        />
                        <span className="text-[13px] font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-iron/40 transition-colors">
                <div>
                  <strong className="text-sm text-chalk block">Include in Discovery Queue</strong>
                  <p className="text-[13px] text-silver mt-0.5">
                    When active, your profile is surfaced to peers matching your mutual criteria.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.showInDiscovery}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, showInDiscovery: e.target.checked }))
                  }
                  className="w-5 h-5 accent-iris cursor-pointer shrink-0"
                />
              </label>

              <div className="px-6 py-4 bg-stage/50">
                <Button type="submit" variant="primary" size="md" disabled={isSaving} isLoading={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Private Preferences'}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 5: PRIVACY & VISIBILITY CONTROLS */}
          {activeTab === 'visibility' && (
            <div className="rounded-[12px] border border-edge bg-coal divide-y divide-edge overflow-hidden">
              <div className="p-6 flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-chalk">
                  Discoverability Controls
                </h2>

                <div className="p-4 rounded-[8px] bg-stage border border-edge">
                  <div className="text-sm font-semibold text-chalk">
                    Current Status:{' '}
                    <span
                      className={
                        isPublished && !isPaused
                          ? 'text-success'
                          : isPaused
                            ? 'text-warning'
                            : 'text-silver'
                      }
                    >
                      {isPublished && !isPaused
                        ? 'Published (Live)'
                        : isPaused
                          ? 'Paused (Hidden from new peers)'
                          : 'Draft (Not published)'}
                    </span>
                  </div>
                  <p className="text-[13px] text-silver mt-1">
                    {isPublished && !isPaused
                      ? 'Your profile card is actively visible to eligible peers in Discover.'
                      : isPaused
                        ? 'You are temporarily hidden from new Discover batches. Existing matches remain active.'
                        : 'Your draft is private. Complete the readiness checklist to publish.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {isPublished && !isPaused ? (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleTogglePublish(false)}
                      disabled={isTogglingDiscovery}
                      className="!border-warning/60 !text-warning"
                    >
                      {isTogglingDiscovery ? 'Pausing...' : 'Pause Discovery Visibility'}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleTogglePublish(true)}
                      disabled={isTogglingDiscovery || photos.length === 0}
                    >
                      {isTogglingDiscovery ? 'Publishing...' : 'Publish Profile to Discover'}
                    </Button>
                  )}

                  <Button variant="secondary" size="md" onClick={handleOpenPreview}>
                    View Peer Preview
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-3">
                <h3 className="text-sm font-semibold text-chalk">SayMyName Privacy Commitments</h3>
                <ul className="space-y-2 text-[13px] text-silver list-disc list-inside leading-relaxed">
                  <li>No unsolicited stranger DMs: messaging requires an active mutual match.</li>
                  <li>Exact GPS or live location is never gathered or exposed.</li>
                  <li>Discovery preferences stay confidential and are omitted from public cards.</li>
                  <li>Signed photo URLs expire automatically and omit device EXIF tags.</li>
                  <li>Passes remain private and unmatching closes channels cleanly.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNT & VERIFICATION INFORMATION */}
          {activeTab === 'account' && (
            <div className="rounded-[12px] border border-edge bg-coal divide-y divide-edge overflow-hidden">
              <div className="p-6 flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-chalk">
                  Verified Student Enrolment
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-[8px] bg-stage border border-edge">
                    <span className="text-xs font-medium text-silver/80">
                      Age Gate Status
                    </span>
                    <div className="text-sm font-semibold text-chalk mt-1.5 flex items-center gap-1.5">
                      <CheckIcon size={15} color="#77C5A1" />
                      <span>18+ Adult Verified</span>
                    </div>
                    <p className="text-xs text-silver/75 mt-1">Exact birth date stays private</p>
                  </div>

                  <div className="p-4 rounded-[8px] bg-stage border border-edge">
                    <span className="text-xs font-medium text-silver/80">
                      Academic Enrolment Status
                    </span>
                    <div className="text-sm font-semibold text-chalk mt-1.5 flex items-center gap-1.5">
                      <CheckIcon size={15} color="#77C5A1" />
                      <span>IITM Non-Campus BS Enrolled</span>
                    </div>
                    <p className="text-xs text-silver/75 mt-1">
                      {PROGRAMME_LABELS[programmeFamily]}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-[8px] bg-iron border border-edge text-[13px] text-silver leading-relaxed">
                  <strong className="text-chalk">Institutional privacy rule:</strong> Student roll numbers, verification evidence, and exact date of birth are never exposed on public APIs or rendered on peer profile cards.
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-chalk">
                  Session &amp; Device Security
                </h2>
                <p className="text-[13px] text-silver leading-relaxed">
                  Signed in on this browser. If you accessed your account from a shared device, revoke all other active sessions immediately.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleRevokeOtherSessions}
                    disabled={isRevokingOthers}
                  >
                    {isRevokingOthers ? 'Revoking...' : 'Sign Out Other Active Devices'}
                  </Button>
                  <Button variant="destructive" size="md" onClick={() => logout()}>
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Live Preview & Readiness Rail (4 Cols Desktop, Sticky) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-[84px] flex flex-col gap-5">
          <div className="rounded-[12px] border border-edge bg-coal overflow-hidden">
            <div className="px-4 py-3 border-b border-edge flex items-center justify-between bg-stage">
              <span className="text-[13px] font-medium text-iris">
                Live Discover Preview
              </span>
              <Badge variant="verified" size="sm">
                Public View
              </Badge>
            </div>

            <div className="relative aspect-[4/3.6] bg-stage overflow-hidden">
              {primaryPhoto?.photoUrl ? (
                <img
                  src={primaryPhoto.photoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-iron text-silver/75 gap-2 p-4 text-center">
                  <UserIcon size={28} />
                  <span className="text-xs">Upload a primary portrait to preview</span>
                </div>
              )}
              <div className="px-3 py-1.5 bg-coal/95 border-t border-edge absolute bottom-0 inset-x-0">
                <span className="text-xs text-chalk font-medium truncate block">
                  {PROGRAMME_LABELS[programmeFamily] || programmeFamily}
                </span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold text-chalk truncate">
                  {displayName || 'Your Display Name'}
                </h3>
                <p className="text-[13px] text-silver mt-0.5">
                  {currentTerm}
                  {coarseLocationPreview ? ` · ${coarseLocationPreview}` : ''}
                  {ageDisplayMode === 'hidden' ? ' · Age hidden' : ''}
                </p>
              </div>

              {bio.trim() && (
                <p className="text-[13px] text-silver line-clamp-3 leading-relaxed">
                  {bio.trim()}
                </p>
              )}

              {selectedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedInterests.slice(0, 5).map((item) => (
                    <span
                      key={item}
                      className="px-2.5 py-1 rounded-[4px] bg-iron border border-edge text-xs text-silver"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2.5 border-t border-edge text-xs text-silver/75">
                Confidential filters, exact DOB, and student ID numbers never appear here.
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-edge bg-coal p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-chalk">Readiness</span>
              <span className="text-iris font-medium tabular-nums">{completionReport.percentage}%</span>
            </div>
            <div className="w-full h-1.5 rounded-[4px] bg-stage overflow-hidden">
              <div
                className="h-full bg-iris transition-all duration-300"
                style={{ width: `${completionReport.percentage}%` }}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleOpenPreview} className="w-full">
              Inspect Full Peer Preview
            </Button>
          </div>
        </aside>
      </div>

      {/* PUBLIC PROFILE PEER PREVIEW MODAL */}
      <Dialog
        isOpen={Boolean(isPreviewOpen && previewData)}
        onClose={() => setIsPreviewOpen(false)}
        title="Peer Discover Preview"
        description="Read-only preview of what eligible IITM BS members see in Discover."
        maxWidth="md"
        footer={
          <Button variant="secondary" size="md" onClick={() => setIsPreviewOpen(false)}>
            Back to Editing
          </Button>
        }
      >
        {previewData && (
          <div className="flex flex-col gap-5">
            <div className="relative aspect-[4/4.2] rounded-[8px] overflow-hidden bg-stage border border-edge">
              {previewData.photos?.[0]?.photoUrl ? (
                <img
                  src={previewData.photos[0].photoUrl}
                  alt={previewData.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-silver/75">
                  <UserIcon size={40} />
                  <span className="text-xs mt-2">No portrait uploaded</span>
                </div>
              )}
              {(previewData.photos || []).length > 1 && (
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-[4px] bg-coal/95 border border-edge text-xs text-chalk tabular-nums">
                  1 / {previewData.photos.length}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-semibold text-chalk">
                  {previewData.displayName}
                  {previewData.age !== null && previewData.age !== undefined
                    ? `, ${previewData.age}`
                    : ''}
                </h3>
                {previewData.isVerified && (
                  <Badge variant="verified" size="sm">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-[13px] text-iris mt-1">
                {PROGRAMME_LABELS[previewData.programmeFamily] || previewData.programmeFamily}
                {previewData.termOrYear && ` · ${previewData.termOrYear}`}
              </p>
              {(previewData.locationCity || previewData.locationState) && (
                <p className="text-[13px] text-silver flex items-center gap-1 mt-1">
                  <PinIcon size={13} />
                  <span>
                    {[previewData.locationCity, previewData.locationState]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </p>
              )}
            </div>

            {previewData.bio && (
              <p className="text-sm text-silver leading-relaxed bg-stage border border-edge rounded-[8px] p-4">
                {previewData.bio}
              </p>
            )}

            {Array.isArray(previewData.interests) && previewData.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {previewData.interests.map((intName, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-[4px] bg-iron border border-edge text-xs text-silver"
                  >
                    {intName}
                  </span>
                ))}
              </div>
            )}

            {Array.isArray(previewData.promptAnswers) && previewData.promptAnswers.length > 0 && (
              <div className="flex flex-col gap-3">
                {previewData.promptAnswers.map((pa) => (
                  <div key={pa.id} className="p-3.5 rounded-[8px] bg-stage border border-edge">
                    <div className="text-xs text-iris font-medium">{pa.promptText}</div>
                    <div className="text-sm text-chalk mt-1">{pa.answerText}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="pt-2 border-t border-edge text-xs text-silver/75 text-center">
              Private preferences, roll numbers, and contact details are strictly omitted from this card.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
