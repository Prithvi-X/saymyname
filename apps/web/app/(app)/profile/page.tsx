'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isPrivateIdentifierLike } from '@saymyname/validation';
import { useAuth } from '../../../lib/auth-context';
import { api, sanitizeDisplayName } from '../../../lib/api';
import { getCachedQuery, invalidateQueryKey, setCachedQuery } from '../../../lib/query-cache';
import { Button, Input, Badge, Dialog, Tabs, Skeleton } from '../../../components/ui';
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
  const cachedProfile = getCachedQuery<any>('profile:me', 120_000);
  const cachedCatalog = getCachedQuery<any>('profile:catalog', 300_000);

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isHydratingProfile, setIsHydratingProfile] = useState<boolean>(() => !cachedProfile);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [isProfileDirty, setIsProfileDirty] = useState<boolean>(false);
  const saveActionBarRef = useRef<HTMLDivElement | null>(null);

  // Form Fields
  const initialCleanName = sanitizeDisplayName(cachedProfile?.displayName || user?.displayName);
  const [displayName, setDisplayName] = useState(initialCleanName);
  const [programmeFamily, setProgrammeFamily] = useState(
    cachedProfile?.programmeFamily || user?.eligibility?.programmeFamily || 'data_science_applications',
  );
  const [currentTerm, setCurrentTerm] = useState(cachedProfile?.termOrYear || 'Foundation Level');
  const [locationCity, setLocationCity] = useState(cachedProfile?.locationCity || '');
  const [locationState, setLocationState] = useState(cachedProfile?.locationState || '');
  const [intention, setIntention] = useState(
    cachedProfile?.intention || 'Long-term intentional relationship',
  );
  const [bio, setBio] = useState(cachedProfile?.bio || '');
  const [ageDisplayMode, setAgeDisplayMode] = useState<'hidden' | 'show_calculated_age'>(
    cachedProfile?.ageDisplayMode === 'hidden' ? 'hidden' : 'show_calculated_age',
  );

  // Photos
  const [photos, setPhotos] = useState<PhotoItem[]>(() => cachedProfile?.photos || []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [supportedImageMimes, setSupportedImageMimes] = useState<string[]>(
    () =>
      (Array.isArray(cachedCatalog?.supportedImageMimes) &&
      cachedCatalog.supportedImageMimes.length > 0
        ? cachedCatalog.supportedImageMimes
        : null) || ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  );

  // Interests & Prompts Catalogs
  const [catalogInterests, setCatalogInterests] = useState<InterestItem[]>(
    () => cachedCatalog?.interests || [],
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() =>
    Array.isArray(cachedProfile?.interests)
      ? cachedProfile.interests.map((i: any) => (typeof i === 'string' ? i : i.interest?.name || i.name))
      : [],
  );
  const [catalogPrompts, setCatalogPrompts] = useState<PromptItem[]>(
    () => cachedCatalog?.prompts || [],
  );
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswerEntry[]>(() =>
    Array.isArray(cachedProfile?.promptAnswers)
      ? cachedProfile.promptAnswers.map((pa: any) => ({
          id: pa.id,
          promptId: pa.promptId,
          promptText: pa.prompt?.promptText || pa.promptText || '',
          answerText: pa.answerText,
        }))
      : [],
  );

  // Dating Preferences (Private)
  const [preferences, setPreferences] = useState<DatingPreferencesState>(() => {
    const prefs = cachedProfile?.preferences;
    return {
      minAge: typeof prefs?.minAge === 'number' ? prefs.minAge : 18,
      maxAge: typeof prefs?.maxAge === 'number' ? prefs.maxAge : 35,
      allowedProgrammes: Array.isArray(prefs?.allowedProgrammes)
        ? prefs.allowedProgrammes
        : [
            'data_science_applications',
            'electronic_systems',
            'aeronautics_space',
            'management_data_science',
          ],
      maxDistanceKm: prefs?.maxDistanceKm ?? null,
      showInDiscovery: prefs?.showInDiscovery !== false,
    };
  });

  // Publication State
  const [isPublished, setIsPublished] = useState(() => Boolean(cachedProfile?.isPublished));
  const [isPaused, setIsPaused] = useState(() => Boolean(cachedProfile?.isPaused));

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

  const hydrateProfile = useCallback(async (opts?: { forceCatalog?: boolean }) => {
    const hasWarmProfile = Boolean(getCachedQuery<any>('profile:me', 120_000));
    if (!hasWarmProfile) {
      setIsHydratingProfile(true);
    }
    setHydrateError(null);

    try {
      const cachedCat = opts?.forceCatalog
        ? null
        : getCachedQuery<any>('profile:catalog', 300_000);
      const [profile, catalog] = await Promise.all([
        api.getProfile(),
        cachedCat
          ? Promise.resolve(cachedCat)
          : api
              .getProfileCatalog()
              .catch(() => ({ interests: [], prompts: [], supportedImageMimes: undefined })),
      ]);

      const prefs = profile?.preferences ?? (await api.getPreferences().catch(() => null));
      setCachedQuery('profile:me', profile);
      if (Array.isArray(catalog?.interests) && catalog.interests.length > 0) {
        setCachedQuery('profile:catalog', catalog);
      }

      setCatalogInterests(catalog.interests || []);
      setCatalogPrompts(catalog.prompts || []);
      if (Array.isArray(catalog.supportedImageMimes) && catalog.supportedImageMimes.length > 0) {
        setSupportedImageMimes(catalog.supportedImageMimes);
      }

      const clean = sanitizeDisplayName(profile.displayName);
      if (clean && clean !== 'Member') setDisplayName(clean);
      if (profile.programmeFamily) setProgrammeFamily(profile.programmeFamily);
      if (profile.termOrYear) setCurrentTerm(profile.termOrYear);
      setLocationCity(profile.locationCity || '');
      setLocationState(profile.locationState || '');
      if (profile.intention) setIntention(profile.intention);
      setBio(profile.bio || '');
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
      setIsProfileDirty(false);
    } catch (err: any) {
      if (!hasWarmProfile) {
        setHydrateError(err?.message || 'Unable to load your profile right now.');
      }
    } finally {
      setIsHydratingProfile(false);
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
        setIsProfileDirty(true);
        setSaveError(null);
        return prev.filter((i) => i !== interestName);
      }
      if (prev.length >= 10) {
        setSaveError('Maximum of 10 personal interests can be selected.');
        return prev;
      }
      setIsProfileDirty(true);
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

    if (!locationCity.trim() || !locationState.trim()) {
      setSaveError('Please enter both City and State in Public Identity & Academics before saving.');
      return;
    }

    if (bio.length > 500) {
      setSaveError('Biography cannot exceed 500 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateProfile({
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
      setCachedQuery('profile:me', updated);
      invalidateQueryKey('discover:');
      setIsProfileDirty(false);
      await Promise.all([refreshUser(), hydrateProfile()]);
      setSaveFeedback('Profile and interests saved cleanly.');
      setTimeout(() => setSaveFeedback(null), 4000);
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

  if (isHydratingProfile) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-24 sm:pt-9 md:pb-12 flex flex-col gap-6 font-ui text-chalk">
        <div className="flex items-center gap-4 pb-5 border-b border-edge/60">
          <Skeleton rounded="control" width="64px" height="64px" />
          <div className="flex flex-col gap-2">
            <Skeleton rounded="tight" width="140px" height="14px" />
            <Skeleton rounded="tight" width="240px" height="28px" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <Skeleton rounded="panel" height="220px" />
            <Skeleton rounded="panel" height="220px" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton rounded="panel" height="420px" />
          </div>
        </div>
      </div>
    );
  }

  if (hydrateError) {
    return (
      <div className="max-w-[820px] mx-auto px-4 py-16 font-ui text-chalk">
        <div className="p-6 rounded-[12px] bg-coal border border-danger/40 flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-chalk">Could not load your profile</h1>
          <p className="text-sm text-silver">{hydrateError}</p>
          <div>
            <Button variant="primary" size="sm" onClick={() => void hydrateProfile()}>
              Retry Loading Profile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-24 sm:pt-9 md:pb-12 flex flex-col gap-6 font-ui text-chalk">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-edge/60 pb-5">
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
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {user?.eligibility?.ageStatus === 'approved' && (
                <Badge variant="verified" size="sm">
                  18+ Verified
                </Badge>
              )}
              {user?.eligibility?.studentStatus === 'approved' && (
                <Badge variant="programme" size="sm">
                  IITM BS Enrolled
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
            <h1 className="text-2xl sm:text-3xl font-semibold text-chalk tracking-tight truncate">
              {displayName || 'Member'}
            </h1>
            <p className="text-xs sm:text-sm text-silver mt-0.5 truncate">
              {PROGRAMME_LABELS[programmeFamily] || 'IITM BS Degree'} • {currentTerm}
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
          {/* TAB 1: OVERVIEW & COMPLETION */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Profile Readiness Summary */}
                <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col justify-between gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] uppercase tracking-[0.12em] text-iris font-semibold">
                        Profile Readiness
                      </span>
                      <span className="text-sm font-semibold text-chalk">
                        {completionReport.percentage}% Complete
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-[4px] bg-stage overflow-hidden mb-4">
                      <div
                        className="h-full bg-iris transition-all duration-500"
                        style={{ width: `${completionReport.percentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-silver leading-relaxed">
                      SayMyName profiles are crafted for intentional 18+ connections within the approved IIT Madras BS community. Complete your public card and private preferences before publishing.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-silver">
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

                {/* Verified Identity Tier */}
                <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-iris">
                      <ShieldIcon size={18} />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                        Verified Identity Tier
                      </span>
                    </div>
                    <ul className="space-y-3 text-xs text-silver">
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} color="#5BB489" className="shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-chalk block">18+ Adult Boundary</strong>
                          <span className="text-[11px] text-ash">
                            Verified via date of birth and manual review
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} color="#5BB489" className="shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-chalk block">IIT Madras BS Enrolment</strong>
                          <span className="text-[11px] text-ash">
                            {PROGRAMME_LABELS[programmeFamily]}
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} color="#5BB489" className="shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-chalk block">Zero PII Exposure</strong>
                          <span className="text-[11px] text-ash">
                            Roll numbers and exact DOB stay strictly off public APIs
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-edge text-[11px] text-ash">
                    Independent platform. Not owned or endorsed by IIT Madras.
                  </div>
                </div>
              </div>

              {/* Discovery Readiness Checklist */}
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-base font-semibold text-chalk">
                    Discovery Readiness Checklist
                  </h2>
                  <span className="text-xs text-ash">
                    {completionReport.completedCount} of {completionReport.total} complete
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {completionReport.checks.map((item) => (
                    <div
                      key={item.key}
                      className={`p-3.5 rounded-[8px] border text-xs flex items-center justify-between gap-3 ${
                        item.done
                          ? 'bg-iron/80 border-edge text-chalk'
                          : 'bg-stage border-edge/70 text-silver'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.done ? (
                        <CheckIcon size={15} color="#5BB489" />
                      ) : (
                        <span className="text-[11px] text-warning font-medium shrink-0">
                          Required
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE (PUBLIC CARD) */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-6">
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-5">
                <div className="flex items-center justify-between gap-2 border-b border-edge pb-3">
                  <h2 className="text-lg font-semibold text-chalk">
                    Public Identity &amp; Academics
                  </h2>
                  <Badge variant="neutral" size="sm">
                    Visible on Discover Card
                  </Badge>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                    Preferred Display Name
                  </label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setIsProfileDirty(true);
                    }}
                    placeholder="e.g. Ananya"
                    maxLength={50}
                    required
                  />
                  <p className="text-[11px] text-ash mt-1.5">
                    How peers address you. Roll numbers, account IDs, or email addresses are prohibited.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-ash mb-2 font-semibold">
                      Verified Academic Programme
                    </label>
                    <input
                      type="text"
                      value={PROGRAMME_LABELS[programmeFamily] || programmeFamily}
                      disabled
                      className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge/70 text-xs text-silver cursor-not-allowed"
                    />
                    <p className="text-[11px] text-ash mt-1">
                      Locked to verified institutional record.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                      Current Study Level / Term
                    </label>
                    <select
                      value={currentTerm}
                      onChange={(e) => {
                        setCurrentTerm(e.target.value);
                        setIsProfileDirty(true);
                      }}
                      className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge text-xs text-chalk focus:border-iris outline-none"
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
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                      City (Coarse)
                    </label>
                    <Input
                      type="text"
                      value={locationCity}
                      onChange={(e) => {
                        setLocationCity(e.target.value);
                        setIsProfileDirty(true);
                      }}
                      placeholder="e.g. Bengaluru"
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                      State
                    </label>
                    <Input
                      type="text"
                      value={locationState}
                      onChange={(e) => {
                        setLocationState(e.target.value);
                        setIsProfileDirty(true);
                      }}
                      placeholder="e.g. Karnataka"
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                      Age Display
                    </label>
                    <select
                      value={ageDisplayMode}
                      onChange={(e) => {
                        setAgeDisplayMode(e.target.value as any);
                        setIsProfileDirty(true);
                      }}
                      className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge text-xs text-chalk focus:border-iris outline-none"
                    >
                      <option value="show_calculated_age">Display verified age</option>
                      <option value="hidden">Hide age on profile</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                    Looking For / Relationship Intention
                  </label>
                  <select
                    value={intention}
                    onChange={(e) => {
                      setIntention(e.target.value);
                      setIsProfileDirty(true);
                    }}
                    className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge text-xs text-chalk focus:border-iris outline-none"
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
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-edge pb-3">
                  <h2 className="text-lg font-semibold text-chalk">Biography</h2>
                  <span
                    className={`text-xs font-mono ${
                      bio.length > 480 ? 'text-warning' : 'text-ash'
                    }`}
                  >
                    {bio.length}/500 characters
                  </span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    setIsProfileDirty(true);
                  }}
                  maxLength={500}
                  rows={5}
                  placeholder="Share your interests, ideas that excite you, and the kind of connection you are looking for..."
                  className="w-full p-4 rounded-[8px] bg-stage border border-edge text-sm text-chalk leading-relaxed focus:border-iris outline-none resize-none transition-colors"
                />
                <p className="text-[11px] text-ash">
                  Minimum 20 characters recommended for Discovery publication. Never auto-rewritten.
                </p>
              </div>

              {/* Curated Interests */}
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-edge pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-chalk">
                      Personal Passions &amp; Interests
                    </h2>
                    <p className="text-xs text-silver mt-0.5">
                      Select 3 to 10 interests that reflect your pursuits.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-iris font-medium">
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
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-iris/[0.14] border-iris text-chalk'
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
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-5">
                <div className="border-b border-edge pb-3">
                  <h2 className="text-lg font-semibold text-chalk">Conversation Prompts</h2>
                  <p className="text-xs text-silver mt-0.5">
                    Answer up to 3 prompts to spark genuine conversations.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  {promptAnswers.map((item, idx) => (
                    <div
                      key={item.promptId || idx}
                      className="p-4 rounded-[8px] bg-stage border border-edge flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-iris font-medium">
                          {item.promptText || 'Conversation Prompt'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPromptAnswers((prev) => prev.filter((_, i) => i !== idx));
                            setIsProfileDirty(true);
                          }}
                          className="text-xs text-danger hover:underline"
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
                          setIsProfileDirty(true);
                        }}
                        maxLength={250}
                        rows={3}
                        placeholder="Your thoughtful response..."
                        className="w-full p-3 rounded-[8px] bg-coal border border-edge text-xs text-chalk focus:border-iris outline-none resize-none"
                      />
                      <div className="text-right text-[10px] text-ash font-mono">
                        {item.answerText.length}/250 characters
                      </div>
                    </div>
                  ))}

                  {promptAnswers.length < 3 && (
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.12em] text-ash mb-2 font-semibold">
                        Add a prompt ({promptAnswers.length}/3)
                      </label>
                      <select
                        onChange={(e) => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          const pObj = catalogPrompts.find((p) => p.id === targetId);
                          if (pObj && !promptAnswers.some((pa) => pa.promptId === targetId)) {
                            setPromptAnswers((prev) => [
                              ...prev,
                              { promptId: pObj.id, promptText: pObj.promptText, answerText: '' },
                            ]);
                            setIsProfileDirty(true);
                          }
                          e.target.value = '';
                        }}
                        className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge text-xs text-chalk focus:border-iris outline-none"
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
              <div ref={saveActionBarRef} className="flex flex-col gap-3 pt-1">
                {saveError && (
                  <div
                    role="alert"
                    className="px-4 py-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-danger text-xs flex items-center gap-2"
                  >
                    <XIcon size={15} />
                    <span>{saveError}</span>
                  </div>
                )}
                {saveFeedback && (
                  <div
                    role="status"
                    className="px-4 py-3 rounded-[8px] bg-coal border border-success/40 text-success text-xs flex items-center gap-2"
                  >
                    <CheckIcon size={15} />
                    <span>{saveFeedback}</span>
                  </div>
                )}
                {isProfileDirty && !saveError && (
                  <p className="text-xs text-warning">
                    You have unsaved profile or interest edits — click Save Profile Changes below to persist them.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="submit" variant="primary" disabled={isSaving} isLoading={isSaving}>
                    {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleOpenPreview}>
                    Open Peer Preview Modal
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: PHOTO MANAGEMENT (R2 VAULT) */}
          {activeTab === 'photos' && (
            <div className="flex flex-col gap-6">
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-chalk">
                    Portrait Media Vault ({photos.length}/6)
                  </h2>
                  <p className="text-xs text-silver leading-relaxed max-w-xl">
                    Upload genuine portrait photographs. Media is stored privately with EXIF/GPS metadata stripped before delivery.
                  </p>
                </div>

                {photos.length < 6 && (
                  <label className="cursor-pointer shrink-0">
                    <span className="h-10 px-4 rounded-[8px] bg-iris text-[#0B0D10] text-xs font-semibold hover:bg-[#9894D1] transition-colors inline-flex items-center gap-2">
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
                  <div className="flex justify-between text-xs text-iris">
                    <span>Uploading to private media storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-[4px] bg-stage overflow-hidden">
                    <div
                      className="h-full bg-iris transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="rounded-[12px] overflow-hidden bg-coal border border-edge flex flex-col group"
                  >
                    <div className="relative aspect-[3/4] bg-stage overflow-hidden">
                      {photo.photoUrl ? (
                        <img
                          src={photo.photoUrl}
                          alt={`Portrait ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-ash p-4 text-center">
                          <UserIcon size={28} />
                          <span className="text-xs mt-2">Private Media Slot</span>
                        </div>
                      )}

                      {photo.isPrimary && (
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-[4px] bg-iris text-[#0B0D10] text-[10px] font-semibold uppercase tracking-wider">
                          Primary
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-iron border-t border-edge flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMovePhoto(index, 'left')}
                          disabled={index === 0}
                          title="Move left"
                          className="px-2 py-1 rounded-[4px] bg-stage text-silver hover:text-chalk disabled:opacity-30"
                        >
                          &larr;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePhoto(index, 'right')}
                          disabled={index === photos.length - 1}
                          title="Move right"
                          className="px-2 py-1 rounded-[4px] bg-stage text-silver hover:text-chalk disabled:opacity-30"
                        >
                          &rarr;
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {!photo.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryPhoto(photo.id)}
                            className="text-iris hover:underline text-[11px] font-medium"
                          >
                            Make Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="text-danger hover:underline text-[11px]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {Array.from({ length: Math.max(0, 6 - photos.length) }).map((_, i) => (
                  <label
                    key={`empty-${i}`}
                    className="rounded-[12px] aspect-[3/4] border border-dashed border-edge hover:border-iris/60 flex flex-col items-center justify-center text-center p-5 cursor-pointer bg-stage/60 transition-colors group"
                  >
                    <span className="w-10 h-10 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-silver group-hover:text-iris mb-2.5 transition-colors">
                      +
                    </span>
                    <span className="text-xs text-silver group-hover:text-chalk font-medium">
                      Add Portrait {photos.length + i + 1}
                    </span>
                    <span className="text-[10px] text-ash mt-1">JPEG, PNG, WebP up to 10MB</span>
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
            <form onSubmit={handleSavePreferences} className="flex flex-col gap-6">
              <div className="p-4 rounded-[8px] bg-iron border border-edge flex items-start gap-3">
                <LockIcon size={18} color="#8580C4" className="shrink-0 mt-0.5" />
                <div className="text-xs text-silver leading-relaxed">
                  <strong className="text-chalk">Confidential Discovery Criteria:</strong> These filters guide reciprocal matching in Discover. They are strictly private and never serialized onto your public profile card.
                </div>
              </div>

              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-chalk border-b border-edge pb-3">
                  Target Age Range
                </h2>
                <p className="text-xs text-silver">
                  Phase 1 is strictly restricted to verified adults aged 18 and above.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                      Minimum Age (18+)
                    </label>
                    <input
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
                      className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge text-sm text-chalk focus:border-iris outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.12em] text-iris mb-2 font-semibold">
                      Maximum Age
                    </label>
                    <input
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
                      className="w-full px-3.5 h-10 rounded-[8px] bg-stage border border-edge text-sm text-chalk focus:border-iris outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-chalk border-b border-edge pb-3">
                  Eligible IITM BS Degree Families
                </h2>
                <p className="text-xs text-silver">
                  Choose which approved programme families you are open to discovering:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(PROGRAMME_LABELS).map(([code, label]) => {
                    const isChecked = preferences.allowedProgrammes.includes(code);
                    return (
                      <label
                        key={code}
                        className={`flex items-center gap-3 p-3.5 rounded-[8px] border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-iris/[0.1] border-iris/60 text-chalk'
                            : 'bg-stage border-edge text-silver hover:border-[#465261]'
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
                          className="accent-iris"
                        />
                        <span className="text-xs font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 rounded-[12px] bg-coal border border-edge flex items-center justify-between gap-4">
                <div>
                  <strong className="text-sm text-chalk block">Include in Discovery Queue</strong>
                  <p className="text-xs text-silver mt-0.5">
                    When active, your profile is surfaced to peers matching your mutual criteria.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.showInDiscovery}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, showInDiscovery: e.target.checked }))
                  }
                  className="w-5 h-5 accent-iris cursor-pointer"
                />
              </div>

              <div>
                <Button type="submit" variant="primary" disabled={isSaving} isLoading={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Private Preferences'}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 5: PRIVACY & VISIBILITY CONTROLS */}
          {activeTab === 'visibility' && (
            <div className="flex flex-col gap-6">
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-chalk border-b border-edge pb-3">
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
                  <p className="text-xs text-silver mt-1">
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
                      onClick={() => handleTogglePublish(false)}
                      disabled={isTogglingDiscovery}
                      className="!border-warning/60 !text-warning"
                    >
                      {isTogglingDiscovery ? 'Pausing...' : 'Pause Discovery Visibility'}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => handleTogglePublish(true)}
                      disabled={isTogglingDiscovery || photos.length === 0}
                    >
                      {isTogglingDiscovery ? 'Publishing...' : 'Publish Profile to Discover'}
                    </Button>
                  )}

                  <Button variant="secondary" onClick={handleOpenPreview}>
                    View Peer Preview Modal
                  </Button>
                </div>
              </div>

              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated space-y-3">
                <h3 className="text-sm font-semibold text-chalk">SayMyName Privacy Commitments</h3>
                <ul className="space-y-2 text-xs text-silver list-disc list-inside leading-relaxed">
                  <li>No unsolicited stranger DMs: messaging requires a mutual match.</li>
                  <li>Exact GPS or live location is never gathered or exposed.</li>
                  <li>Dating preferences remain encrypted and strictly private.</li>
                  <li>Signed photo URLs expire automatically and omit device EXIF tags.</li>
                  <li>Unilateral exit from Relationship Mode supported anytime.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNT & VERIFICATION INFORMATION */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-6">
              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-chalk border-b border-edge pb-3">
                  Verified Student Enrolment
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-[8px] bg-stage border border-edge">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-ash font-semibold">
                      Age Gate Status
                    </span>
                    <div className="text-sm font-semibold text-chalk mt-1.5 flex items-center gap-1.5">
                      <CheckIcon size={15} color="#5BB489" />
                      <span>18+ Adult Verified</span>
                    </div>
                    <p className="text-[11px] text-ash mt-1">Exact birth date is confidential</p>
                  </div>

                  <div className="p-4 rounded-[8px] bg-stage border border-edge">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-ash font-semibold">
                      Academic Enrolment Status
                    </span>
                    <div className="text-sm font-semibold text-chalk mt-1.5 flex items-center gap-1.5">
                      <CheckIcon size={15} color="#5BB489" />
                      <span>IITM Non-Campus BS Enrolled</span>
                    </div>
                    <p className="text-[11px] text-ash mt-1">
                      {PROGRAMME_LABELS[programmeFamily]}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-[8px] bg-iron border border-edge text-xs text-silver leading-relaxed">
                  <strong className="text-chalk">Institutional Privacy Rule:</strong> Student roll numbers, verification evidence, and exact date of birth are never exposed on public APIs or rendered on peer profile cards.
                </div>
              </div>

              <div className="p-6 rounded-[12px] bg-coal border border-edge smn-surface-elevated flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-chalk border-b border-edge pb-3">
                  Session &amp; Device Security
                </h2>
                <p className="text-xs text-silver leading-relaxed">
                  Signed in on this browser. If you accessed your account from a shared computer, you can revoke all other active sessions immediately.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRevokeOtherSessions}
                    disabled={isRevokingOthers}
                  >
                    {isRevokingOthers ? 'Revoking...' : 'Sign Out Other Active Devices'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => logout()}>
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Live Preview & Readiness Rail (4 Cols Desktop, Sticky) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-[84px] flex flex-col gap-5">
          <div className="rounded-[12px] border border-edge bg-coal smn-surface-elevated overflow-hidden">
            <div className="px-4 py-3 border-b border-edge flex items-center justify-between bg-stage/70">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris">
                Live Discover Card Preview
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
                <div className="w-full h-full flex flex-col items-center justify-center bg-iron text-ash gap-2 p-4 text-center">
                  <UserIcon size={28} />
                  <span className="text-xs">Upload a primary portrait to preview</span>
                </div>
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0B0D10]/90 to-transparent"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-[4px] smn-glass-control text-[11px] text-chalk font-medium truncate">
                  {PROGRAMME_LABELS[programmeFamily] || programmeFamily}
                </span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold text-chalk truncate">
                  {displayName || 'Your Display Name'}
                </h3>
                <p className="text-xs text-silver mt-0.5">
                  {currentTerm}
                  {coarseLocationPreview ? ` • ${coarseLocationPreview}` : ''}
                  {ageDisplayMode === 'hidden' ? ' • Age hidden' : ''}
                </p>
              </div>

              {bio.trim() && (
                <p className="text-xs text-silver line-clamp-3 leading-relaxed">
                  {bio.trim()}
                </p>
              )}

              {selectedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedInterests.slice(0, 5).map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 rounded-[4px] bg-iron border border-edge text-[11px] text-silver"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-edge text-[11px] text-ash">
                Confidential filters, exact DOB, and student ID numbers never appear on this card.
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-edge bg-coal smn-surface-elevated p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-chalk">Readiness</span>
              <span className="font-mono text-iris">{completionReport.percentage}%</span>
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
          <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>
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
                <div className="w-full h-full flex flex-col items-center justify-center text-ash">
                  <UserIcon size={40} />
                  <span className="text-xs mt-2">No Portrait Uploaded</span>
                </div>
              )}
              {(previewData.photos || []).length > 1 && (
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-[4px] smn-glass-control text-[11px] font-mono text-chalk">
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
                    IITM Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-iris mt-1">
                {PROGRAMME_LABELS[previewData.programmeFamily] || previewData.programmeFamily}
                {previewData.termOrYear && ` • ${previewData.termOrYear}`}
              </p>
              {(previewData.locationCity || previewData.locationState) && (
                <p className="text-xs text-ash flex items-center gap-1 mt-1">
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
              <p className="text-sm text-silver leading-relaxed border-l-2 border-iris/75 pl-3.5">
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
                  <div key={pa.id} className="border-l-2 border-iris/60 pl-3 py-0.5">
                    <div className="text-xs text-iris font-medium">{pa.promptText}</div>
                    <div className="text-sm text-chalk mt-0.5">{pa.answerText}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="pt-2 border-t border-edge text-[11px] text-ash text-center">
              Private preferences, roll numbers, and contact details are strictly omitted from this card.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
