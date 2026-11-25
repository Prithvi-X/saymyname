'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { isPrivateIdentifierLike } from '@saymyname/validation';
import { useAuth } from '../../../lib/auth-context';
import { api, sanitizeDisplayName } from '../../../lib/api';
import { Button, Input, Badge } from '../../../components/ui';
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
        api.getProfileCatalog().catch(() => ({ interests: [], prompts: [] })),
        api.getPreferences().catch(() => null),
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

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setSaveError('Unsupported photo format. Allowed: JPEG, PNG, WebP, or HEIC.');
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

  return (
    <div className="min-h-screen bg-[#0B0D0E] text-[#E6E4DF] pb-24 selection:bg-[#C8A97E]/30 selection:text-white">
      {/* Top Identity Header */}
      <div className="border-b border-[#262B30] bg-[#131618]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Primary Portrait Thumbnail / Monogram */}
            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-[#1C2024] border border-[#3A4148] flex items-center justify-center shrink-0">
              {primaryPhoto?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryPhoto.photoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-serif text-[#C8A97E]">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
              {user?.eligibility?.studentStatus === 'approved' && (
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 bg-[#22C55E] rounded-full border-2 border-[#0B0D0E]"
                  title="IITM Verified Student"
                />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif tracking-tight text-[#E6E4DF]">
                  {displayName || 'Member'}
                </h1>
                {user?.eligibility?.ageStatus === 'approved' && (
                  <Badge variant="verified">18+ Verified</Badge>
                )}
              </div>
              <p className="text-xs text-[#8C9094] flex items-center gap-1.5 mt-0.5">
                <span>{PROGRAMME_LABELS[programmeFamily] || 'IITM BS Degree'}</span>
                <span>•</span>
                <span>{currentTerm}</span>
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPreview}
              disabled={isLoadingPreview}
              className="border-[#3A4148] text-[#E6E4DF] hover:bg-[#1C2024]"
            >
              <CompassIcon size={16} color="currentColor" className="mr-1.5" />
              {isLoadingPreview ? 'Loading...' : 'Peer Preview'}
            </Button>

            {isPublished && !isPaused ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTogglePublish(false)}
                disabled={isTogglingDiscovery}
                className="border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10"
              >
                Pause Discovery
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTogglePublish(true)}
                disabled={isTogglingDiscovery || completionReport.percentage < 70}
                className="bg-[#C8A97E] text-[#0B0D0E] font-medium hover:bg-[#d8b98e]"
              >
                Publish to Discover
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Global Feedback Banner */}
        {saveFeedback && (
          <div className="mb-6 p-4 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-sm flex items-center gap-2.5 animate-fadeIn">
            <CheckIcon size={18} color="#22C55E" />
            <span>{saveFeedback}</span>
          </div>
        )}
        {saveError && (
          <div className="mb-6 p-4 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm flex items-center gap-2.5 animate-fadeIn">
            <XIcon size={18} color="#EF4444" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#262B30] mb-8 scrollbar-none">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'edit', label: 'Edit Profile' },
            { id: 'photos', label: `Photographs (${photos.length}/6)` },
            { id: 'preferences', label: 'Dating Preferences' },
            { id: 'visibility', label: 'Privacy & Visibility' },
            { id: 'account', label: 'Account & Verification' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProfileTab)}
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#1C2024] text-[#C8A97E] border border-[#3A4148]'
                  : 'text-[#8C9094] hover:text-[#E6E4DF] hover:bg-[#131618]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & COMPLETION */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Status & Completion Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 p-6 rounded-xl bg-[#131618] border border-[#262B30] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-[#C8A97E] font-medium">
                      Profile Readiness
                    </span>
                    <span className="text-sm font-semibold text-[#E6E4DF]">
                      {completionReport.percentage}% Complete
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[#1C2024] overflow-hidden mb-5">
                    <div
                      className="h-full bg-gradient-to-r from-[#C8A97E] to-[#E6E4DF] transition-all duration-500 rounded-full"
                      style={{ width: `${completionReport.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-[#8C9094] leading-relaxed">
                    SayMyName profiles are crafted for intentional adult connections within the
                    approved IIT Madras BS community. Complete your profile details and private
                    preferences before publishing into Discovery.
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-[#262B30] flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#8C9094]">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        isPublished && !isPaused ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
                      }`}
                    />
                    <span>
                      Status:{' '}
                      <strong className="text-[#E6E4DF]">
                        {isPublished && !isPaused
                          ? 'Live in Discover'
                          : isPaused
                            ? 'Paused'
                            : 'Draft (Private)'}
                      </strong>
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('edit')}
                    className="border-[#3A4148] text-xs"
                  >
                    Continue Editing
                  </Button>
                </div>
              </div>

              {/* Verified Identity Summary Card */}
              <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-[#C8A97E]">
                    <ShieldIcon size={20} color="currentColor" />
                    <span className="text-sm font-semibold tracking-wide">
                      Verified Identity Tier
                    </span>
                  </div>
                  <ul className="space-y-3 text-xs text-[#8C9094]">
                    <li className="flex items-start gap-2">
                      <CheckIcon size={15} color="#22C55E" className="shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#E6E4DF]">18+ Adult Boundary</strong>
                        <p className="text-[11px] text-[#5D6268]">Strictly verified via date of birth</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon size={15} color="#22C55E" className="shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#E6E4DF]">IIT Madras BS Enrolment</strong>
                        <p className="text-[11px] text-[#5D6268]">{PROGRAMME_LABELS[programmeFamily]}</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon size={15} color="#22C55E" className="shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#E6E4DF]">Zero PII Leakage</strong>
                        <p className="text-[11px] text-[#5D6268]">Student roll numbers and exact DOBs remain confidential</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-[#262B30] text-[11px] text-[#5D6268]">
                  Independent platform. Not owned or endorsed by IIT Madras.
                </div>
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30]">
              <h2 className="text-base font-serif text-[#E6E4DF] mb-4">
                Discovery Readiness Checklist
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {completionReport.checks.map((item) => (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                      item.done
                        ? 'bg-[#1C2024]/60 border-[#3A4148] text-[#E6E4DF]'
                        : 'bg-[#0B0D0E]/60 border-[#262B30] text-[#8C9094]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.done ? (
                      <CheckIcon size={16} color="#22C55E" />
                    ) : (
                      <span className="text-[11px] text-[#F59E0B]">Required</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: EDIT PROFILE */}
        {/* ========================================================================= */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSaveProfile} className="space-y-8 animate-fadeIn max-w-3xl">
            {/* Identity & Academic presentation */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-6">
              <h2 className="text-lg font-serif text-[#E6E4DF] border-b border-[#262B30] pb-3">
                Public Identity & Academics
              </h2>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                  Preferred Display Name
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Ananya"
                  maxLength={50}
                  required
                />
                <p className="text-[11px] text-[#8C9094] mt-1.5">
                  How peers will address you. Roll numbers, account IDs, or email addresses are strictly prohibited.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8C9094] mb-2 font-medium">
                    Verified Academic Programme
                  </label>
                  <input
                    type="text"
                    value={PROGRAMME_LABELS[programmeFamily] || programmeFamily}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0D0E] border border-[#262B30] text-xs text-[#8C9094] cursor-not-allowed font-medium"
                  />
                  <p className="text-[10px] text-[#5D6268] mt-1">
                    Verified via institutional record. Cannot be edited directly.
                  </p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                    Current Study Level / Term
                  </label>
                  <select
                    value={currentTerm}
                    onChange={(e) => setCurrentTerm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#1C2024] border border-[#3A4148] text-xs text-[#E6E4DF] focus:border-[#C8A97E] outline-none"
                  >
                    <option value="Foundation Level">Foundation Level</option>
                    <option value="Diploma in Programming">Diploma in Programming</option>
                    <option value="Diploma in Data Science">Diploma in Data Science</option>
                    <option value="BSc Degree Level">BSc Degree Level</option>
                    <option value="BS Degree Level">BS Degree Level</option>
                    <option value="Final Term / Capstone">Final Term / Capstone</option>
                  </select>
                  <p className="text-[10px] text-[#8C9094] mt-1">
                    Member-maintained academic progress indicator.
                  </p>
                </div>
              </div>

              {/* Coarse Location & Age Display */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                    City (Coarse)
                  </label>
                  <Input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    maxLength={60}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                    State
                  </label>
                  <Input
                    type="text"
                    value={locationState}
                    onChange={(e) => setLocationState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    maxLength={60}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                    Age Display
                  </label>
                  <select
                    value={ageDisplayMode}
                    onChange={(e) => setAgeDisplayMode(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#1C2024] border border-[#3A4148] text-xs text-[#E6E4DF] focus:border-[#C8A97E] outline-none"
                  >
                    <option value="show_calculated_age">Display verified age</option>
                    <option value="hidden">Hide age on profile</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                  Looking For / Relationship Intention
                </label>
                <select
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#1C2024] border border-[#3A4148] text-xs text-[#E6E4DF] focus:border-[#C8A97E] outline-none"
                >
                  <option value="Long-term intentional relationship">Long-term intentional relationship</option>
                  <option value="Intentional dating & deep connection">Intentional dating & deep connection</option>
                  <option value="Thoughtful companionship across distance">Thoughtful companionship across distance</option>
                  <option value="Getting to know each other over study sessions">Getting to know each other over study sessions</option>
                </select>
              </div>
            </div>

            {/* Biography with Character Counter */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-4">
              <div className="flex items-center justify-between border-b border-[#262B30] pb-3">
                <h2 className="text-lg font-serif text-[#E6E4DF]">Biography</h2>
                <span
                  className={`text-xs font-mono ${
                    bio.length > 480 ? 'text-[#F59E0B]' : 'text-[#8C9094]'
                  }`}
                >
                  {bio.length}/500 characters
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Share your passions, what intellectual ideas excite you, and what kind of partner you hope to discover..."
                className="w-full p-4 rounded-lg bg-[#0B0D0E] border border-[#3A4148] text-sm text-[#E6E4DF] leading-relaxed focus:border-[#C8A97E] outline-none resize-none transition-colors"
              />
              <p className="text-[11px] text-[#8C9094]">
                A minimum of 20 characters is required for Discover publication. No AI auto-rewrites.
              </p>
            </div>

            {/* Curated Interests (Max 10) */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-4">
              <div className="flex items-center justify-between border-b border-[#262B30] pb-3">
                <div>
                  <h2 className="text-lg font-serif text-[#E6E4DF]">Personal Passions & Interests</h2>
                  <p className="text-xs text-[#8C9094] mt-0.5">
                    Select 3 to 10 interests that reflect your pursuits.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#C8A97E]">
                  {selectedInterests.length}/10 selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {catalogInterests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.name);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.name)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-[#C8A97E]/15 border-[#C8A97E] text-[#E6E4DF]'
                          : 'bg-[#1C2024]/40 border-[#262B30] text-[#8C9094] hover:border-[#3A4148] hover:text-[#E6E4DF]'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {interest.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conversation Starter Prompts (Max 3) */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-6">
              <div className="border-b border-[#262B30] pb-3">
                <h2 className="text-lg font-serif text-[#E6E4DF]">Conversation Prompts</h2>
                <p className="text-xs text-[#8C9094] mt-0.5">
                  Answer up to 3 prompts to spark meaningful conversations.
                </p>
              </div>

              {/* Existing prompt answers */}
              <div className="space-y-4">
                {promptAnswers.map((item, idx) => (
                  <div
                    key={item.promptId || idx}
                    className="p-4 rounded-lg bg-[#0B0D0E] border border-[#3A4148] space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#C8A97E] font-medium font-serif">
                        {item.promptText || 'Conversation Prompt'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPromptAnswers((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-xs text-[#EF4444] hover:underline"
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
                      className="w-full p-3 rounded-lg bg-[#131618] border border-[#262B30] text-xs text-[#E6E4DF] focus:border-[#C8A97E] outline-none resize-none"
                    />
                    <div className="text-right text-[10px] text-[#5D6268]">
                      {item.answerText.length}/250 characters
                    </div>
                  </div>
                ))}

                {/* Add prompt selector */}
                {promptAnswers.length < 3 && (
                  <div className="pt-2">
                    <label className="block text-xs uppercase tracking-wider text-[#8C9094] mb-2 font-medium">
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
                        }
                        e.target.value = '';
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#1C2024] border border-[#3A4148] text-xs text-[#E6E4DF] focus:border-[#C8A97E] outline-none"
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

            {/* Save Button Bar */}
            <div className="flex items-center justify-between pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isSaving}
                className="bg-[#C8A97E] text-[#0B0D0E] font-medium px-8 hover:bg-[#d8b98e]"
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleOpenPreview}
                className="text-xs text-[#8C9094] hover:text-[#E6E4DF]"
              >
                Peer Preview →
              </Button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PHOTO MANAGEMENT (R2 VAULT) */}
        {/* ========================================================================= */}
        {activeTab === 'photos' && (
          <div className="space-y-8 animate-fadeIn max-w-4xl">
            {/* Guidelines & Upload Banner */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-lg font-serif text-[#E6E4DF]">
                  Portrait Media Vault ({photos.length}/6)
                </h2>
                <p className="text-xs text-[#8C9094] leading-relaxed">
                  Upload genuine portrait photographs. Photos are stored in an authenticated private Cloudflare R2 bucket.
                  EXIF metadata including GPS tags are stripped prior to delivery.
                </p>
              </div>

              {photos.length < 6 && (
                <label className="cursor-pointer shrink-0">
                  <span className="px-5 py-2.5 rounded-lg bg-[#C8A97E] text-[#0B0D0E] text-xs font-semibold hover:bg-[#d8b98e] transition-colors inline-flex items-center gap-2">
                    {isUploadingPhoto ? 'Uploading...' : '+ Upload Portrait'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress !== null && (
              <div className="p-4 rounded-lg bg-[#1C2024] border border-[#3A4148] space-y-2">
                <div className="flex justify-between text-xs text-[#C8A97E]">
                  <span>Uploading to private R2 storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0B0D0E] overflow-hidden">
                  <div
                    className="h-full bg-[#C8A97E] transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 6-Slot Photo Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="rounded-xl overflow-hidden bg-[#131618] border border-[#262B30] flex flex-col group relative"
                >
                  <div className="relative aspect-[3/4] bg-[#0B0D0E] overflow-hidden">
                    {photo.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.photoUrl}
                        alt={`Portrait ${index + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#5D6268] p-4 text-center">
                        <UserIcon size={32} />
                        <span className="text-xs mt-2">Private Media Slot</span>
                      </div>
                    )}

                    {photo.isPrimary && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#C8A97E] text-[#0B0D0E] text-[11px] font-bold tracking-wider uppercase shadow-md">
                        Primary Portrait
                      </div>
                    )}
                  </div>

                  {/* Photo Actions Footer */}
                  <div className="p-3 bg-[#1C2024] border-t border-[#262B30] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(index, 'left')}
                        disabled={index === 0}
                        title="Move left"
                        className="px-2 py-1 rounded bg-[#0B0D0E] text-[#8C9094] hover:text-[#E6E4DF] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(index, 'right')}
                        disabled={index === photos.length - 1}
                        title="Move right"
                        className="px-2 py-1 rounded bg-[#0B0D0E] text-[#8C9094] hover:text-[#E6E4DF] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        →
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!photo.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryPhoto(photo.id)}
                          className="text-[#C8A97E] hover:underline text-[11px]"
                        >
                          Make Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="text-[#EF4444] hover:underline text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty placeholder slots up to 6 */}
              {Array.from({ length: Math.max(0, 6 - photos.length) }).map((_, i) => (
                <label
                  key={`empty-${i}`}
                  className="rounded-xl aspect-[3/4] border-2 border-dashed border-[#262B30] hover:border-[#3A4148] flex flex-col items-center justify-center text-center p-6 cursor-pointer bg-[#0B0D0E]/40 transition-colors group"
                >
                  <span className="w-10 h-10 rounded-full bg-[#1C2024] flex items-center justify-center text-[#8C9094] group-hover:text-[#C8A97E] group-hover:bg-[#1C2024]/80 mb-2 transition-all">
                    +
                  </span>
                  <span className="text-xs text-[#8C9094] group-hover:text-[#E6E4DF]">
                    Add Portrait {photos.length + i + 1}
                  </span>
                  <span className="text-[10px] text-[#5D6268] mt-1">JPEG, PNG, WebP up to 10MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DATING PREFERENCES (PRIVATE) */}
        {/* ========================================================================= */}
        {activeTab === 'preferences' && (
          <form onSubmit={handleSavePreferences} className="space-y-8 animate-fadeIn max-w-3xl">
            {/* Private Banner Notice */}
            <div className="p-4 rounded-xl bg-[#1C2024]/60 border border-[#3A4148] flex items-start gap-3">
              <LockIcon size={20} color="#C8A97E" className="shrink-0 mt-0.5" />
              <div className="text-xs text-[#8C9094] leading-relaxed">
                <strong className="text-[#E6E4DF]">Confidential Discovery Criteria:</strong> These
                preferences guide candidate recommendations in Discovery. They are strictly private
                and are never serialized into your public profile or shared with peers.
              </div>
            </div>

            {/* Age Range Filter */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-4">
              <h2 className="text-lg font-serif text-[#E6E4DF] border-b border-[#262B30] pb-3">
                Target Age Range
              </h2>
              <p className="text-xs text-[#8C9094]">
                Phase 1 is strictly restricted to adults aged 18 and above.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                    Minimum Age (18+)
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={preferences.maxAge}
                    value={preferences.minAge}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, minAge: parseInt(e.target.value) || 18 }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0D0E] border border-[#3A4148] text-sm text-[#E6E4DF] focus:border-[#C8A97E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#C8A97E] mb-2 font-medium">
                    Maximum Age
                  </label>
                  <input
                    type="number"
                    min={preferences.minAge}
                    max={65}
                    value={preferences.maxAge}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, maxAge: parseInt(e.target.value) || 35 }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0D0E] border border-[#3A4148] text-sm text-[#E6E4DF] focus:border-[#C8A97E] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Allowed Programme Families */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-4">
              <h2 className="text-lg font-serif text-[#E6E4DF] border-b border-[#262B30] pb-3">
                Eligible IITM BS Degree Families
              </h2>
              <p className="text-xs text-[#8C9094]">
                Choose which approved programme families you are open to discovering:
              </p>

              <div className="space-y-3 pt-2">
                {Object.entries(PROGRAMME_LABELS).map(([code, label]) => {
                  const isChecked = preferences.allowedProgrammes.includes(code);
                  return (
                    <label
                      key={code}
                      className="flex items-center gap-3 p-3.5 rounded-lg bg-[#0B0D0E] border border-[#262B30] cursor-pointer hover:border-[#3A4148] transition-colors"
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
                        className="rounded border-[#3A4148] text-[#C8A97E] focus:ring-0"
                      />
                      <span className="text-xs font-medium text-[#E6E4DF]">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Discovery Exposure Toggle */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] flex items-center justify-between gap-4">
              <div>
                <strong className="text-sm text-[#E6E4DF]">Include in Discovery Queue</strong>
                <p className="text-xs text-[#8C9094] mt-0.5">
                  When active, your profile will be recommended to peers matching your mutual criteria.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.showInDiscovery}
                onChange={(e) =>
                  setPreferences((prev) => ({ ...prev, showInDiscovery: e.target.checked }))
                }
                className="w-5 h-5 rounded border-[#3A4148] text-[#C8A97E] focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Save Preferences Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={isSaving}
                className="bg-[#C8A97E] text-[#0B0D0E] font-medium px-8 hover:bg-[#d8b98e]"
              >
                {isSaving ? 'Saving...' : 'Save Private Preferences'}
              </Button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PRIVACY & VISIBILITY CONTROLS */}
        {/* ========================================================================= */}
        {activeTab === 'visibility' && (
          <div className="space-y-8 animate-fadeIn max-w-3xl">
            {/* Status Card */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-4">
              <h2 className="text-lg font-serif text-[#E6E4DF] border-b border-[#262B30] pb-3">
                Discoverability Controls
              </h2>

              <div className="p-4 rounded-lg bg-[#0B0D0E] border border-[#3A4148] flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#E6E4DF]">
                    Current Status:{' '}
                    <span
                      className={
                        isPublished && !isPaused
                          ? 'text-[#22C55E]'
                          : isPaused
                            ? 'text-[#F59E0B]'
                            : 'text-[#8C9094]'
                      }
                    >
                      {isPublished && !isPaused
                        ? 'Published (Live)'
                        : isPaused
                          ? 'Paused (Hidden from new peers)'
                          : 'Draft (Not published)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8C9094] mt-1">
                    {isPublished && !isPaused
                      ? 'Your profile card is actively visible to eligible peers in Discover.'
                      : isPaused
                        ? 'You are temporarily hidden from new Discover stacks. Existing matches remain active.'
                        : 'Your draft is private. Complete the readiness checklist to publish.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-4">
                {isPublished && !isPaused ? (
                  <Button
                    variant="secondary"
                    onClick={() => handleTogglePublish(false)}
                    disabled={isTogglingDiscovery}
                    className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                  >
                    {isTogglingDiscovery ? 'Pausing...' : 'Pause Discovery Visibility'}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => handleTogglePublish(true)}
                    disabled={isTogglingDiscovery || photos.length === 0}
                    className="bg-[#C8A97E] text-[#0B0D0E] font-medium hover:bg-[#d8b98e]"
                  >
                    {isTogglingDiscovery ? 'Publishing...' : 'Publish Profile to Discover'}
                  </Button>
                )}

                <Button
                  variant="secondary"
                  onClick={handleOpenPreview}
                  className="border-[#3A4148] text-[#E6E4DF]"
                >
                  View Peer Preview
                </Button>
              </div>
            </div>

            {/* Privacy Commitments */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-3">
              <h3 className="text-sm font-semibold text-[#E6E4DF]">
                SayMyName Privacy Commitments
              </h3>
              <ul className="space-y-2 text-xs text-[#8C9094] list-disc list-inside leading-relaxed">
                <li>No unsolicited stranger DMs: messaging requires mutual match.</li>
                <li>Exact GPS or live location is never gathered or exposed.</li>
                <li>Dating preferences remain encrypted and strictly private.</li>
                <li>Signed photo URLs expire automatically in 180 seconds.</li>
                <li>Unilateral unpairing supported at any time.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: ACCOUNT & VERIFICATION INFORMATION */}
        {/* ========================================================================= */}
        {activeTab === 'account' && (
          <div className="space-y-8 animate-fadeIn max-w-3xl">
            {/* Verification Status */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-6">
              <h2 className="text-lg font-serif text-[#E6E4DF] border-b border-[#262B30] pb-3">
                Verified Student Enrolment
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#0B0D0E] border border-[#262B30]">
                  <span className="text-[11px] uppercase tracking-wider text-[#C8A97E]">
                    Age Gate Status
                  </span>
                  <div className="text-sm font-semibold text-[#E6E4DF] mt-1 flex items-center gap-1.5">
                    <CheckIcon size={16} color="#22C55E" />
                    <span>18+ Adult Verified</span>
                  </div>
                  <p className="text-[10px] text-[#5D6268] mt-1">Exact birth date is confidential</p>
                </div>

                <div className="p-4 rounded-lg bg-[#0B0D0E] border border-[#262B30]">
                  <span className="text-[11px] uppercase tracking-wider text-[#C8A97E]">
                    Academic Enrolment Status
                  </span>
                  <div className="text-sm font-semibold text-[#E6E4DF] mt-1 flex items-center gap-1.5">
                    <CheckIcon size={16} color="#22C55E" />
                    <span>IITM Non-Campus BS Enrolled</span>
                  </div>
                  <p className="text-[10px] text-[#5D6268] mt-1">{PROGRAMME_LABELS[programmeFamily]}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#1C2024]/40 border border-[#262B30] text-xs text-[#8C9094] space-y-1">
                <p>
                  <strong>Institutional Privacy Rule:</strong> Under Document 01 §3.5, your student
                  roll number, verification documents, and exact date of birth are stored securely and
                  never exposed on public APIs or rendered on profile cards.
                </p>
              </div>
            </div>

            {/* Session Security */}
            <div className="p-6 rounded-xl bg-[#131618] border border-[#262B30] space-y-4">
              <h2 className="text-lg font-serif text-[#E6E4DF] border-b border-[#262B30] pb-3">
                Session & Device Security
              </h2>
              <p className="text-xs text-[#8C9094]">
                Signed in on this browser. If you accessed your account from a shared campus or lab
                computer, you can revoke all other active sessions immediately.
              </p>

              <div className="flex items-center gap-4 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRevokeOtherSessions}
                  disabled={isRevokingOthers}
                  className="border-[#3A4148] text-xs text-[#E6E4DF]"
                >
                  {isRevokingOthers ? 'Revoking...' : 'Sign Out Other Active Devices'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  className="text-xs text-[#EF4444] hover:bg-[#EF4444]/10"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PUBLIC PROFILE PEER PREVIEW MODAL */}
      {/* ========================================================================= */}
      {isPreviewOpen && previewData && (
        <div className="fixed inset-0 z-50 bg-[#0B0D0E]/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#131618] border border-[#3A4148] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#262B30] flex items-center justify-between sticky top-0 bg-[#131618]/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                <CompassIcon size={18} color="#C8A97E" />
                <span className="text-xs uppercase tracking-wider text-[#C8A97E] font-medium">
                  Peer Discover Preview (Read-Only)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-[#8C9094] hover:text-[#E6E4DF] p-1.5"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Card Content (Exact peer view) */}
            <div className="p-6 space-y-6">
              {/* Photo Carousel or Primary Photo */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#0B0D0E] border border-[#262B30]">
                {previewData.photos?.[0]?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewData.photos[0].photoUrl}
                    alt={previewData.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#5D6268]">
                    <UserIcon size={48} />
                    <span className="text-xs mt-3">No Portrait Uploaded</span>
                  </div>
                )}
                {/* Photo Count badge */}
                {(previewData.photos || []).length > 1 && (
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-[#0B0D0E]/80 backdrop-blur-sm text-[11px] text-[#E6E4DF]">
                    1 / {previewData.photos.length} photos
                  </div>
                )}
              </div>

              {/* Public Header */}
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-2xl font-serif text-[#E6E4DF]">
                    {previewData.displayName}
                  </h3>
                  {previewData.age !== null && (
                    <span className="text-2xl font-serif text-[#8C9094]">
                      {previewData.age}
                    </span>
                  )}
                  {previewData.isVerified && (
                    <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-medium">
                      ✓ IITM Verified
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#C8A97E] mt-1">
                  {PROGRAMME_LABELS[previewData.programmeFamily] || previewData.programmeFamily}
                  {previewData.termOrYear && ` • ${previewData.termOrYear}`}
                </p>

                {(previewData.locationCity || previewData.locationState) && (
                  <p className="text-xs text-[#8C9094] flex items-center gap-1 mt-1">
                    <PinIcon size={13} color="currentColor" />
                    <span>
                      {[previewData.locationCity, previewData.locationState]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </p>
                )}
              </div>

              {/* Intention Pill */}
              {previewData.intention && (
                <div className="inline-block px-3 py-1.5 rounded-lg bg-[#1C2024] border border-[#3A4148] text-xs text-[#E6E4DF]">
                  🎯 {previewData.intention}
                </div>
              )}

              {/* Bio Quote Card */}
              {previewData.bio && (
                <div className="p-4 rounded-xl bg-[#0B0D0E] border border-[#262B30]">
                  <p className="text-sm text-[#E6E4DF] leading-relaxed italic font-serif">
                    &ldquo;{previewData.bio}&rdquo;
                  </p>
                </div>
              )}

              {/* Interests */}
              {Array.isArray(previewData.interests) && previewData.interests.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#8C9094] font-medium">
                    Interests & Passions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewData.interests.map((intName, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-[#1C2024] border border-[#3A4148] text-xs text-[#E6E4DF]"
                      >
                        {intName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation Prompts */}
              {Array.isArray(previewData.promptAnswers) && previewData.promptAnswers.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[11px] uppercase tracking-wider text-[#8C9094] font-medium">
                    Conversation Starters
                  </span>
                  {previewData.promptAnswers.map((pa) => (
                    <div
                      key={pa.id}
                      className="p-4 rounded-xl bg-[#0B0D0E] border border-[#262B30] space-y-1.5"
                    >
                      <div className="text-xs text-[#C8A97E] font-medium">
                        {pa.promptText}
                      </div>
                      <div className="text-sm text-[#E6E4DF] leading-relaxed">
                        {pa.answerText}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Privacy Reassurance Note */}
              <div className="pt-2 border-t border-[#262B30] text-[11px] text-[#5D6268] text-center">
                Private preferences, roll numbers, and contact details are strictly omitted from this card.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#262B30] flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
                className="border-[#3A4148] text-xs text-[#E6E4DF]"
              >
                Back to Editing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
