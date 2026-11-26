'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, DiscoveryCandidate, LikeResponse, ReportCategory } from '../../../lib/api';

function getErrorStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as any).status === 'number') {
    return (err as any).status;
  }
  return null;
}
import {
  formatCandidateHeading,
  formatCoarseLocation,
  formatIntentionLabel,
  formatProgrammeLabel,
  getInitials,
  mergeFeedBatch,
  removeCandidateById,
  REPORT_CATEGORY_OPTIONS,
} from '../../../lib/discover-state';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  IntervalEmptyComposition,
  MutualMatchDialog,
} from '../../../components/ui';
import {
  CompassIcon,
  FlagIcon,
  HeartIcon,
  ShieldIcon,
  UserIcon,
  XIcon,
} from '../../../components/icons';

type ActionKind = 'like' | 'pass' | 'block';

function generateActionKey(prefix: string, profileId: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${profileId}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${profileId}-${Date.now()}`;
}

export default function DiscoverPage() {
  const router = useRouter();

  // Feed & Pagination State
  const [queue, setQueue] = useState<DiscoveryCandidate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [viewerState, setViewerState] = useState<'ready' | 'paused' | 'profile_incomplete'>('ready');
  const [appliedPrefs, setAppliedPrefs] = useState<{
    minAge: number;
    maxAge: number;
    allowedProgrammes: string[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isResuming, setIsResuming] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    kind: ActionKind;
    message: string;
    profileId: string;
  } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Per-candidate photo gallery + failed image fallback state
  const [photoIndex, setPhotoIndex] = useState<number>(0);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);

  // Modals: Full Profile, Mutual Match Interval, Report, Block
  const [fullProfileOpen, setFullProfileOpen] = useState<boolean>(false);
  const [fullProfileLoading, setFullProfileLoading] = useState<boolean>(false);
  const [fullProfilePhotoIndex, setFullProfilePhotoIndex] = useState<number>(0);
  const [matchResult, setMatchResult] = useState<LikeResponse | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportAlsoBlock, setReportAlsoBlock] = useState<boolean>(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [blockModalOpen, setBlockModalOpen] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [isSubmittingBlock, setIsSubmittingBlock] = useState<boolean>(false);

  // Stable per-candidate idempotency keys so retrying a transient failure reuses the same key
  const idempotencyKeysRef = useRef<Record<string, string>>({});

  const currentCandidate = queue[0] ?? null;

  const getOrCreateActionKey = (kind: 'like' | 'pass', profileId: string): string => {
    const slot = `${kind}:${profileId}`;
    if (!idempotencyKeysRef.current[slot]) {
      idempotencyKeysRef.current[slot] = generateActionKey(kind, profileId);
    }
    return idempotencyKeysRef.current[slot];
  };

  const clearActionKeys = (profileId: string) => {
    delete idempotencyKeysRef.current[`like:${profileId}`];
    delete idempotencyKeysRef.current[`pass:${profileId}`];
  };

  const loadInitialFeed = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const feed = await api.getDiscoverFeed({ limit: 10 });
      setQueue(feed.candidates);
      setNextCursor(feed.nextCursor);
      setHasMore(feed.hasMore);
      setViewerState(feed.viewerState);
      if (feed.preferencesApplied) {
        setAppliedPrefs({
          minAge: feed.preferencesApplied.minAge,
          maxAge: feed.preferencesApplied.maxAge,
          allowedProgrammes: feed.preferencesApplied.allowedProgrammes,
        });
      }
      setPhotoIndex(0);
    } catch (err: any) {
      if (getErrorStatus(err) === 401) {
        router.push('/login');
        return;
      }
      setLoadError(err?.message || 'Unable to load verified peer recommendations right now.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadNextBatch = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const feed = await api.getDiscoverFeed({ cursor: nextCursor, limit: 10 });
      setQueue((prev) => mergeFeedBatch(prev, feed));
      setNextCursor(feed.nextCursor);
      setHasMore(feed.hasMore);
      setViewerState(feed.viewerState);
    } catch (err: any) {
      if (
        getErrorStatus(err) === 400 &&
        String(err?.message || '').toLowerCase().includes('cursor')
      ) {
        setNextCursor(null);
        await loadInitialFeed();
        return;
      }
      setStatusNotice(err?.message || 'Could not load additional recommendations.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, nextCursor, isLoadingMore, loadInitialFeed]);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Reset photo gallery index when advancing to the next candidate
  useEffect(() => {
    setPhotoIndex(0);
    setFullProfilePhotoIndex(0);
  }, [currentCandidate?.profileId]);

  // Automatically prefetch next page cleanly when queue drops to <= 2 cards and cursor remains
  useEffect(() => {
    if (!isLoading && queue.length > 0 && queue.length <= 2 && hasMore && nextCursor && !isLoadingMore) {
      loadNextBatch();
    }
  }, [queue.length, hasMore, nextCursor, isLoading, isLoadingMore, loadNextBatch]);

  const handleResumeDiscovery = async () => {
    setIsResuming(true);
    setLoadError(null);
    setStatusNotice(null);
    try {
      await api.publishProfile({ isPublished: true, acceptGuidelinesConsent: true });
      await api.updatePreferences({ showInDiscovery: true });
      await loadInitialFeed();
      setStatusNotice('Your discovery visibility is now active.');
    } catch (err: any) {
      setLoadError(
        err?.message || 'Could not resume discovery visibility. Review your profile first.',
      );
    } finally {
      setIsResuming(false);
    }
  };

  const removeCurrentCandidateAndAdvance = (profileId: string, notice?: string) => {
    clearActionKeys(profileId);
    setActionError(null);
    setFullProfileOpen(false);
    setQueue((prev) => removeCandidateById(prev, profileId));
    if (notice) {
      setStatusNotice(notice);
    }
  };

  const handleOpenFullProfile = async () => {
    if (!currentCandidate) return;
    setFullProfilePhotoIndex(photoIndex);
    setFullProfileOpen(true);
    setFullProfileLoading(true);
    try {
      const fresh = await api.getCandidateDetail(currentCandidate.profileId);
      setQueue((prev) => prev.map((c) => (c.profileId === fresh.profileId ? fresh : c)));
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 404 || status === 403) {
        removeCurrentCandidateAndAdvance(
          currentCandidate.profileId,
          'This profile is no longer available in your discovery feed.',
        );
      }
    } finally {
      setFullProfileLoading(false);
    }
  };

  const handlePass = async () => {
    if (!currentCandidate || activeAction) return;
    const target = currentCandidate;
    const key = getOrCreateActionKey('pass', target.profileId);

    setActiveAction('pass');
    setActionError(null);
    setStatusNotice(null);

    try {
      await api.passCandidate(target.profileId, key);
      removeCurrentCandidateAndAdvance(target.profileId);
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 404 || status === 403 || status === 409) {
        removeCurrentCandidateAndAdvance(
          target.profileId,
          'This profile became unavailable and was removed from your feed.',
        );
      } else {
        setActionError({
          kind: 'pass',
          profileId: target.profileId,
          message: err?.message || 'Unable to record pass right now. Your queue has been preserved.',
        });
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleLike = async () => {
    if (!currentCandidate || activeAction) return;
    const target = currentCandidate;
    const key = getOrCreateActionKey('like', target.profileId);

    setActiveAction('like');
    setActionError(null);
    setStatusNotice(null);

    try {
      const res = await api.likeCandidate(target.profileId, key);
      removeCurrentCandidateAndAdvance(target.profileId);

      if (res.isMutualMatch) {
        setMatchResult(res);
      } else {
        setStatusNotice(`Interest sent privately to ${target.displayName}.`);
      }
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 404 || status === 403) {
        removeCurrentCandidateAndAdvance(
          target.profileId,
          'This profile is paused or unavailable and could not receive a Like.',
        );
      } else {
        setActionError({
          kind: 'like',
          profileId: target.profileId,
          message: err?.message || 'Unable to send Like right now. Please retry safely.',
        });
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleConfirmBlock = async () => {
    if (!currentCandidate || isSubmittingBlock) return;
    const target = currentCandidate;
    setIsSubmittingBlock(true);
    setActionError(null);

    try {
      await api.blockCandidate(
        target.profileId,
        blockReason.trim() || 'Blocked from Discover',
      );
      setBlockModalOpen(false);
      setBlockReason('');
      removeCurrentCandidateAndAdvance(
        target.profileId,
        `${target.displayName} has been blocked. Neither of you will see each other in discovery or messages.`,
      );
    } catch (err: any) {
      setActionError({
        kind: 'block',
        profileId: target.profileId,
        message: err?.message || 'Unable to complete block right now. Please retry.',
      });
      setBlockModalOpen(false);
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCandidate || isSubmittingReport) return;
    const target = currentCandidate;

    setIsSubmittingReport(true);
    setReportError(null);

    try {
      await api.reportCandidate(
        target.profileId,
        reportCategory,
        reportDescription.trim() || undefined,
      );

      let blockedSucceeded = false;
      if (reportAlsoBlock) {
        try {
          await api.blockCandidate(target.profileId, `Reported: ${reportCategory}`);
          blockedSucceeded = true;
        } catch {
          blockedSucceeded = false;
        }
      }

      setReportModalOpen(false);
      setReportDescription('');
      removeCurrentCandidateAndAdvance(
        target.profileId,
        reportAlsoBlock
          ? blockedSucceeded
            ? `Report submitted to Trust & Safety and ${target.displayName} has been blocked.`
            : `Report submitted for ${target.displayName}, though automatic blocking failed. You can block separately if needed.`
          : `Report submitted confidentially for ${target.displayName}.`,
      );
    } catch (err: any) {
      setReportError(err?.message || 'Could not submit report right now. Please retry.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Keyboard shortcuts on active card photo navigation
  const candidatePhotos = currentCandidate?.photos || [];
  const handlePrevPhoto = () => {
    if (candidatePhotos.length <= 1) return;
    setPhotoIndex((i) => (i > 0 ? i - 1 : candidatePhotos.length - 1));
  };
  const handleNextPhoto = () => {
    if (candidatePhotos.length <= 1) return;
    setPhotoIndex((i) => (i < candidatePhotos.length - 1 ? i + 1 : 0));
  };

  const currentPhoto = candidatePhotos[photoIndex] ?? candidatePhotos[0] ?? null;
  const modalPhoto = candidatePhotos[fullProfilePhotoIndex] ?? candidatePhotos[0] ?? null;

  const isNarrowFilters =
    appliedPrefs &&
    (appliedPrefs.allowedProgrammes.length < 4 || appliedPrefs.maxAge - appliedPrefs.minAge < 6);

  return (
    <main className="min-h-[calc(100vh-68px)] bg-stage text-chalk">
      <div className="container-app pt-5 sm:pt-7 pb-28 md:pb-12">
        {/* Calm Compact Workspace Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-edge">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-[1.75rem] font-semibold text-chalk tracking-[-0.02em]">
              Discover
            </h1>
            <p className="text-[13px] sm:text-sm text-silver mt-0.5">
              Verified adult learners across the four approved IIT Madras BS tracks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
            {appliedPrefs && (
              <span className="inline-flex items-center px-3 min-h-[40px] rounded-[8px] bg-coal border border-edge text-[13px] text-silver tabular-nums">
                Age {appliedPrefs.minAge}&ndash;{appliedPrefs.maxAge} &middot;{' '}
                {appliedPrefs.allowedProgrammes.length}{' '}
                {appliedPrefs.allowedProgrammes.length === 1 ? 'track' : 'tracks'}
              </span>
            )}
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-[8px] bg-iron border border-edge text-[13px] font-medium text-chalk hover:bg-slate transition-colors focus-visible:outline-2 focus-visible:outline-iris"
            >
              <span>Preferences &amp; Profile</span>
            </Link>
          </div>
        </header>

        {/* Ephemeral Status Notice (Accessible Polite Live Region) */}
        {statusNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 flex items-center justify-between gap-4 px-4 py-3 bg-iron border border-edge rounded-[8px] text-sm text-silver"
          >
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-xs font-medium text-silver hover:text-chalk px-2.5 py-1.5 rounded-[4px]"
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div
            data-testid="discover-loading"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            <div className="lg:col-span-8 bg-coal border border-edge rounded-[12px] overflow-hidden animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-6 min-h-[380px] bg-iron" />
                <div className="md:col-span-6 p-6 flex flex-col gap-4">
                  <div className="h-7 w-44 bg-slate rounded-[4px]" />
                  <div className="h-4 w-56 bg-slate rounded-[4px]" />
                  <div className="h-24 w-full bg-iron rounded-[6px]" />
                  <div className="h-12 w-full bg-iron border border-edge rounded-[8px] mt-auto" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-4 animate-pulse">
              <div className="h-40 bg-coal border border-edge rounded-[12px]" />
              <div className="h-32 bg-coal border border-edge rounded-[12px]" />
            </div>
          </div>
        ) : loadError ? (
          <EmptyState
            title="Could not load discovery"
            description={loadError}
            actionLabel="Retry loading"
            onAction={loadInitialFeed}
            icon={<CompassIcon size={22} />}
          />
        ) : viewerState === 'paused' ? (
          <IntervalEmptyComposition
            variant="paused"
            testId="discover-paused-state"
            eyebrow="Visibility paused"
            title="Your profile visibility is currently paused"
            description="You are hidden from other members' Discover feeds and cannot send new Likes while paused. Your existing mutual matches and conversations remain active."
            primaryAction={{
              label: 'Resume Discovery',
              onClick: handleResumeDiscovery,
              isLoading: isResuming,
              variant: 'primary',
              testId: 'resume-discovery-btn',
            }}
            secondaryAction={{
              label: 'Edit Profile & Filters',
              onClick: () => router.push('/profile'),
              variant: 'secondary',
            }}
            facts={[
              { label: 'Feed visibility', value: 'Hidden from peers' },
              { label: 'Existing chats', value: 'Active matches preserved' },
            ]}
          />
        ) : viewerState === 'profile_incomplete' ? (
          <EmptyState
            title="Complete your profile before browsing"
            description="Publish your verified display name, at least one portrait photo, and community consent on your Profile before viewing peers."
            actionLabel="Open Profile Readiness"
            onAction={() => router.push('/profile')}
            icon={<UserIcon size={22} />}
          />
        ) : !currentCandidate ? (
          <IntervalEmptyComposition
            variant="discover"
            testId="discover-empty-state"
            eyebrow="Batch complete"
            title="No more verified peers match right now"
            description={
              isNarrowFilters
                ? 'You have reached the end of your current reciprocal matches. Broadening your age range or programme filters in Profile can surface more verified peers.'
                : 'You have reviewed everyone currently matching your reciprocal age and programme preferences. New verified students join regularly.'
            }
            primaryAction={{
              label: 'Adjust Filters',
              onClick: () => router.push('/profile'),
              variant: 'secondary',
            }}
            secondaryAction={{
              label: 'Refresh Feed',
              onClick: loadInitialFeed,
              variant: 'tertiary',
            }}
            facts={
              appliedPrefs
                ? [
                    {
                      label: 'Active age range',
                      value: `${appliedPrefs.minAge}–${appliedPrefs.maxAge}`,
                    },
                    {
                      label: 'Selected tracks',
                      value: `${appliedPrefs.allowedProgrammes.length} ${
                        appliedPrefs.allowedProgrammes.length === 1 ? 'programme' : 'programmes'
                      }`,
                    },
                  ]
                : [
                    {
                      label: 'Matching rule',
                      value: 'Reciprocal 18+ IITM BS',
                    },
                  ]
            }
          />
        ) : (
          /* Main Active Candidate Experience: Candidate-First Asymmetric Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Candidate Surface (Left 8 Cols Desktop): Portrait + Story + Explicit Actions */}
            <section
              aria-label="Current discovery candidate"
              data-testid="discover-candidate-card"
              className="lg:col-span-8 bg-coal border border-edge rounded-[12px] overflow-hidden flex flex-col"
            >
              {/* Action Error Preserve & Retry Banner */}
              {actionError && actionError.profileId === currentCandidate.profileId && (
                <div
                  role="alert"
                  className="px-5 py-3 bg-[#301618] border-b border-danger/40 flex flex-wrap items-center justify-between gap-3 text-sm text-danger"
                >
                  <span>{actionError.message}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (actionError.kind === 'like') handleLike();
                      else if (actionError.kind === 'pass') handlePass();
                      else setBlockModalOpen(true);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Split Primary Hero Band: Uncluttered Portrait Left + Human Story & Actions Right */}
              <div className="grid grid-cols-1 md:grid-cols-12">
                {/* Portrait Frame (6 Cols md+, Pure Media Without Overcrowded Badges) */}
                <div
                  className="md:col-span-6 relative aspect-[4/4.5] md:aspect-auto md:min-h-[450px] lg:min-h-[490px] bg-stage overflow-hidden select-none border-b md:border-b-0 md:border-r border-edge"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') handlePrevPhoto();
                    if (e.key === 'ArrowRight') handleNextPhoto();
                  }}
                >
                  {/* Segmented Photo Indicator Bars */}
                  {candidatePhotos.length > 1 && (
                    <div
                      className="absolute top-3 left-3 right-3 z-20 flex gap-1.5"
                      role="tablist"
                      aria-label="Candidate photos"
                    >
                      {candidatePhotos.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          role="tab"
                          aria-selected={idx === photoIndex}
                          aria-label={`View photo ${idx + 1} of ${candidatePhotos.length}`}
                          onClick={() => setPhotoIndex(idx)}
                          className={`h-[3px] flex-1 transition-colors ${
                            idx === photoIndex ? 'bg-chalk' : 'bg-edge hover:bg-silver/60'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {currentPhoto?.photoUrl && !brokenPhotoIds[currentPhoto.id] ? (
                    <img
                      src={currentPhoto.photoUrl}
                      alt={`${currentCandidate.displayName} portrait ${photoIndex + 1}`}
                      onError={() =>
                        setBrokenPhotoIds((prev) => ({ ...prev, [currentPhoto.id]: true }))
                      }
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-iron text-silver gap-3 p-6">
                      <div className="w-20 h-20 rounded-[8px] bg-slate border border-edge flex items-center justify-center text-2xl font-semibold text-chalk tracking-wider">
                        {getInitials(currentCandidate.displayName)}
                      </div>
                      <p className="text-[13px] text-silver/80">
                        Portrait unavailable
                      </p>
                    </div>
                  )}

                  {/* Solid Edge Controls for Photo Gallery (44x44 accessible target) */}
                  {candidatePhotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevPhoto}
                        aria-label="Previous photo"
                        data-testid="photo-prev-btn"
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-[8px] bg-coal/90 border border-edge text-chalk flex items-center justify-center hover:bg-iron transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                      >
                        <span aria-hidden="true" className="text-lg leading-none">
                          &lsaquo;
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPhoto}
                        aria-label="Next photo"
                        data-testid="photo-next-btn"
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-[8px] bg-coal/90 border border-edge text-chalk flex items-center justify-center hover:bg-iron transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                      >
                        <span aria-hidden="true" className="text-lg leading-none">
                          &rsaquo;
                        </span>
                      </button>
                    </>
                  )}

                  {candidatePhotos.length > 1 && (
                    <span className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-[4px] bg-coal/95 border border-edge text-xs font-medium text-silver tabular-nums">
                      {photoIndex + 1} / {candidatePhotos.length}
                    </span>
                  )}
                </div>

                {/* Right Story & Action Column Inside Candidate Focus (6 Cols md+) */}
                <div className="md:col-span-6 p-5 sm:p-6 lg:p-7 flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="verified" size="sm">
                        Verified
                      </Badge>
                      <Badge variant="programme" size="sm">
                        {formatProgrammeLabel(currentCandidate.programmeFamily)}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h2
                          data-testid="candidate-heading"
                          className="text-[1.75rem] sm:text-[2rem] leading-[1.1] font-semibold text-chalk tracking-[-0.02em]"
                        >
                          {formatCandidateHeading(
                            currentCandidate.displayName,
                            currentCandidate.age,
                          )}
                        </h2>
                        <button
                          type="button"
                          onClick={handleOpenFullProfile}
                          data-testid="open-full-profile-btn"
                          className="text-[13px] font-medium text-iris hover:text-iris-hover underline underline-offset-4 py-1.5 shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                        >
                          Full profile &rarr;
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-silver">
                        {currentCandidate.currentTerm && (
                          <span className="text-chalk font-medium">
                            {currentCandidate.currentTerm}
                          </span>
                        )}
                        {formatCoarseLocation(
                          currentCandidate.locationCity,
                          currentCandidate.locationState,
                        ) && (
                          <span>
                            {formatCoarseLocation(
                              currentCandidate.locationCity,
                              currentCandidate.locationState,
                            )}
                          </span>
                        )}
                        {!currentCandidate.ageVisible && (
                          <span className="text-silver/75">Age private</span>
                        )}
                      </div>

                      {formatIntentionLabel(currentCandidate.intention) && (
                        <p className="text-[13px] text-silver mt-2">
                          Looking for:{' '}
                          <span className="text-chalk font-medium">
                            {formatIntentionLabel(currentCandidate.intention)}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Primary Bio Right Beside Portrait */}
                    <div className="pt-3 border-t border-edge">
                      <h3 className="text-xs font-medium text-silver/80 mb-1.5">
                        About {currentCandidate.displayName}
                      </h3>
                      <p className="text-sm sm:text-[15px] text-chalk/95 leading-[1.6] whitespace-pre-line">
                        {currentCandidate.bio?.trim()
                          ? currentCandidate.bio
                          : 'No written biography added yet.'}
                      </p>
                    </div>
                  </div>

                  {/* Primary Action Dock & Safety Row (Visible Above the Fold) */}
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={handlePass}
                        disabled={Boolean(activeAction)}
                        isLoading={activeAction === 'pass'}
                        data-testid="pass-btn"
                        leftIcon={<XIcon size={18} />}
                        className="w-full"
                      >
                        Pass
                      </Button>

                      <Button
                        variant="warm"
                        size="lg"
                        onClick={handleLike}
                        disabled={Boolean(activeAction)}
                        isLoading={activeAction === 'like'}
                        data-testid="like-btn"
                        leftIcon={<HeartIcon size={18} />}
                        className="w-full"
                      >
                        Like
                      </Button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-edge text-xs text-silver/80">
                      <span>Passes stay strictly private</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setReportError(null);
                            setReportModalOpen(true);
                          }}
                          data-testid="report-open-btn"
                          className="inline-flex items-center gap-1.5 min-h-[36px] px-2 text-silver/85 hover:text-warning transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                        >
                          <FlagIcon size={14} />
                          <span>Report</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBlockModalOpen(true)}
                          data-testid="block-open-btn"
                          className="inline-flex items-center gap-1.5 min-h-[36px] px-2 text-silver/85 hover:text-danger transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                        >
                          <ShieldIcon size={14} />
                          <span>Block</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integrated Prompts & Interests Band Below Portrait/Story */}
              {(currentCandidate.promptAnswers.length > 0 || currentCandidate.interests.length > 0) && (
                <div className="border-t border-edge bg-stage/40 p-5 sm:p-6 lg:p-7 grid grid-cols-1 md:grid-cols-12 gap-6">
                  {currentCandidate.promptAnswers.length > 0 && (
                    <div className="md:col-span-7 flex flex-col gap-3">
                      <h3 className="text-[13px] font-medium text-silver">
                        Conversation prompts
                      </h3>
                      <div className="flex flex-col gap-3">
                        {currentCandidate.promptAnswers.map((pa, idx) => (
                          <div
                            key={pa.id || `${currentCandidate.profileId}-p-${idx}`}
                            className="p-4 rounded-[8px] bg-iron border border-edge flex flex-col gap-1"
                          >
                            <p className="text-[13px] font-medium text-iris">
                              {pa.promptText}
                            </p>
                            <p className="text-[15px] text-chalk leading-relaxed">
                              &ldquo;{pa.answerText}&rdquo;
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentCandidate.interests.length > 0 && (
                    <div
                      className={`${
                        currentCandidate.promptAnswers.length > 0 ? 'md:col-span-5' : 'md:col-span-12'
                      } flex flex-col gap-3`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-medium text-silver">
                          Interests
                        </h3>
                        {currentCandidate.sharedInterests &&
                          currentCandidate.sharedInterests.length > 0 && (
                            <span className="text-xs text-iris font-medium">
                              {currentCandidate.sharedInterests.length} shared with you
                            </span>
                          )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {currentCandidate.interests.map((interest) => {
                          const isShared = currentCandidate.sharedInterests?.includes(interest);
                          return (
                            <span
                              key={interest}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[13px] font-medium border ${
                                isShared
                                  ? 'bg-[#1C1C2E] border-iris/60 text-chalk'
                                  : 'bg-iron border-edge text-silver'
                              }`}
                            >
                              {isShared && (
                                <span className="w-1.5 h-1.5 bg-iris shrink-0" aria-hidden="true" />
                              )}
                              {interest}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Right Quiet Context Column (4 Cols Desktop) */}
            <aside className="lg:col-span-4 lg:sticky lg:top-[84px] flex flex-col gap-5">
              {candidatePhotos.length > 1 && (
                <div className="bg-coal border border-edge rounded-[12px] p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[13px] text-silver">
                    <span className="font-medium text-chalk">Photos ({candidatePhotos.length})</span>
                    <span className="text-xs text-silver/75">Arrow keys switch</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {candidatePhotos.map((p, idx) => (
                      <button
                        key={`thumb-${p.id}`}
                        type="button"
                        onClick={() => setPhotoIndex(idx)}
                        aria-label={`Select portrait ${idx + 1}`}
                        className={`relative aspect-[3/4] rounded-[6px] overflow-hidden border transition-colors focus-visible:outline-2 focus-visible:outline-iris ${
                          idx === photoIndex
                            ? 'border-iris ring-1 ring-iris'
                            : 'border-edge opacity-70 hover:opacity-100'
                        }`}
                      >
                        {p.photoUrl && !brokenPhotoIds[p.id] ? (
                          <img src={p.photoUrl} alt="" className="w-full h-full object-cover block" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center bg-iron text-xs text-silver">
                            {idx + 1}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-coal border border-edge rounded-[12px] p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-edge">
                  <span className="text-sm font-semibold text-chalk">
                    Discovery session
                  </span>
                  <span className="text-xs text-silver tabular-nums">
                    {queue.length} queued
                  </span>
                </div>

                {appliedPrefs && (
                  <p className="text-[13px] text-silver leading-relaxed">
                    Showing peers aged {appliedPrefs.minAge}&ndash;{appliedPrefs.maxAge} across{' '}
                    {appliedPrefs.allowedProgrammes.length} approved BS{' '}
                    {appliedPrefs.allowedProgrammes.length === 1 ? 'programme' : 'programmes'} with reciprocal filters.
                  </p>
                )}

                <p className="text-[13px] text-silver/85 leading-relaxed">
                  Messaging unlocks only if both of you choose Like independently. Unilateral choices stay private.
                </p>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenFullProfile}
                    data-testid="view-profile-btn"
                    leftIcon={<UserIcon size={15} />}
                    className="w-full"
                  >
                    Inspect full profile
                  </Button>

                  {hasMore && nextCursor && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={loadNextBatch}
                      isLoading={isLoadingMore}
                      data-testid="load-more-btn"
                      className="w-full"
                    >
                      Load next batch
                    </Button>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Full Candidate Profile Modal */}
      {currentCandidate && (
        <Dialog
          isOpen={fullProfileOpen}
          onClose={() => setFullProfileOpen(false)}
          title={formatCandidateHeading(currentCandidate.displayName, currentCandidate.age)}
          description={formatProgrammeLabel(currentCandidate.programmeFamily)}
          maxWidth="lg"
          footer={
            <div className="w-full flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFullProfileOpen(false);
                    setReportError(null);
                    setReportModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-ash hover:text-warning py-1.5"
                >
                  <FlagIcon size={14} />
                  <span>Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullProfileOpen(false);
                    setBlockModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-ash hover:text-danger py-1.5"
                >
                  <ShieldIcon size={14} />
                  <span>Block</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePass}
                  isLoading={activeAction === 'pass'}
                  disabled={Boolean(activeAction)}
                  leftIcon={<XIcon size={15} />}
                  className="!bg-coal !border !border-edge"
                >
                  Pass
                </Button>
                <Button
                  variant="warm"
                  size="sm"
                  onClick={handleLike}
                  isLoading={activeAction === 'like'}
                  disabled={Boolean(activeAction)}
                  leftIcon={<HeartIcon size={15} />}
                >
                  Like
                </Button>
              </div>
            </div>
          }
        >
          <div data-testid="full-profile-modal" className="max-h-[65vh] overflow-y-auto pr-1 flex flex-col gap-5">
            {fullProfileLoading && (
              <p className="text-xs text-ash">Refreshing live profile availability...</p>
            )}

            {/* Photo Gallery Viewer */}
            <div className="border border-edge bg-coal flex flex-col">
              <div className="relative aspect-[16/9] bg-stage overflow-hidden">
                {modalPhoto?.photoUrl && !brokenPhotoIds[modalPhoto.id] ? (
                  <img
                    src={modalPhoto.photoUrl}
                    alt={`${currentCandidate.displayName} full portrait ${fullProfilePhotoIndex + 1}`}
                    className="w-full h-full object-contain bg-stage"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-iron text-chalk font-semibold text-xl">
                    {getInitials(currentCandidate.displayName)}
                  </div>
                )}
              </div>
              {candidatePhotos.length > 1 && (
                <div className="flex gap-1.5 p-2 bg-coal border-t border-edge overflow-x-auto">
                  {candidatePhotos.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFullProfilePhotoIndex(idx)}
                      className={`px-2.5 py-1 rounded-[4px] text-xs border transition-colors ${
                        idx === fullProfilePhotoIndex
                          ? 'bg-iris text-stage border-iris font-semibold'
                          : 'bg-iron text-silver border-edge hover:bg-slate'
                      }`}
                    >
                      Photo {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="verified" size="sm">
                Verified
              </Badge>
              <Badge variant="programme" size="sm">
                {formatProgrammeLabel(currentCandidate.programmeFamily)}
              </Badge>
              {currentCandidate.currentTerm && (
                <Badge variant="neutral" size="sm">
                  {currentCandidate.currentTerm}
                </Badge>
              )}
              {formatCoarseLocation(
                currentCandidate.locationCity,
                currentCandidate.locationState,
              ) && (
                <Badge variant="neutral" size="sm">
                  {formatCoarseLocation(
                    currentCandidate.locationCity,
                    currentCandidate.locationState,
                  )}
                </Badge>
              )}
            </div>

            {formatIntentionLabel(currentCandidate.intention) && (
              <p className="text-xs text-silver">
                Intention:{' '}
                <strong className="text-chalk font-medium">
                  {formatIntentionLabel(currentCandidate.intention)}
                </strong>
              </p>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ash mb-1.5">
                Biography
              </h3>
              <p className="text-sm text-chalk leading-relaxed whitespace-pre-line">
                {currentCandidate.bio?.trim() || 'No written biography provided.'}
              </p>
            </div>

            {currentCandidate.promptAnswers.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ash">
                  Prompts
                </h3>
                {currentCandidate.promptAnswers.map((pa, idx) => (
                  <div key={pa.id || idx} className="p-3 rounded-[8px] bg-coal border border-edge">
                    <p className="text-xs text-iris font-medium mb-1">{pa.promptText}</p>
                    <p className="text-sm text-chalk">{pa.answerText}</p>
                  </div>
                ))}
              </div>
            )}

            {currentCandidate.interests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ash mb-2">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {currentCandidate.interests.map((interest) => (
                    <span
                      key={interest}
                      className="px-2.5 py-1 rounded-[4px] bg-coal border border-edge text-xs text-silver"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Mutual Match Interval Celebration Modal (Document 10 Threshold Signature Moment) */}
      <MutualMatchDialog
        matchResult={matchResult}
        onClose={() => setMatchResult(null)}
        onOpenConversation={(res) => {
          setMatchResult(null);
          if (res.matchId) {
            const conv = res.conversationId ? `&conversationId=${encodeURIComponent(res.conversationId)}` : '';
            router.push(`/chats?matchId=${encodeURIComponent(res.matchId)}${conv}`);
          } else {
            router.push('/chats');
          }
        }}
      />

      {/* Block Confirmation Modal */}
      {currentCandidate && (
        <Dialog
          isOpen={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          title={`Block ${currentCandidate.displayName}?`}
          description="Blocking acts immediately in both directions."
          maxWidth="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBlockModalOpen(false)}
                disabled={isSubmittingBlock}
                className="!bg-coal !border !border-edge"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmBlock}
                isLoading={isSubmittingBlock}
                data-testid="confirm-block-btn"
              >
                Confirm Block
              </Button>
            </>
          }
        >
          <div data-testid="block-modal" className="flex flex-col gap-3">
            <p className="text-sm text-silver leading-relaxed">
              This will immediately hide your profiles from each other across Discover, revoke any pending Like or Match, and prevent future messaging or invitations.
            </p>
            <label className="flex flex-col gap-1.5 text-xs text-ash">
              <span>Optional private note (visible only to Trust &amp; Safety records)</span>
              <input
                type="text"
                maxLength={250}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full h-10 px-3 rounded-[6px] bg-coal border border-edge text-sm text-chalk placeholder:text-ash focus-visible:outline-2 focus-visible:outline-iris"
              />
            </label>
          </div>
        </Dialog>
      )}

      {/* Safety Report Modal */}
      {currentCandidate && (
        <Dialog
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          title={`Report ${currentCandidate.displayName}`}
          description="Reports are reviewed confidentially by Trust & Safety moderators."
          maxWidth="md"
        >
          <form
            onSubmit={handleSubmitReport}
            data-testid="report-modal"
            className="flex flex-col gap-3.5 max-h-[72vh] overflow-y-auto pr-1"
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-ash mb-1">
                Category
              </legend>
              {REPORT_CATEGORY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                    reportCategory === opt.value
                      ? 'bg-slate/60 border-iris text-chalk'
                      : 'bg-coal border-edge text-silver hover:bg-iron'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportCategory"
                    value={opt.value}
                    checked={reportCategory === opt.value}
                    onChange={() => setReportCategory(opt.value)}
                    className="mt-1 accent-[#8580C4]"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-chalk">{opt.label}</span>
                    <span className="text-xs text-ash">{opt.description}</span>
                  </div>
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-1.5 text-xs text-ash">
              <span>Context (optional, max 1000 chars)</span>
              <textarea
                rows={3}
                maxLength={1000}
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Describe what happened without guessing private facts..."
                className="w-full p-3 rounded-[6px] bg-coal border border-edge text-sm text-chalk placeholder:text-ash focus-visible:outline-2 focus-visible:outline-iris"
              />
            </label>

            <label className="flex items-center gap-2.5 text-xs text-silver cursor-pointer">
              <input
                type="checkbox"
                checked={reportAlsoBlock}
                onChange={(e) => setReportAlsoBlock(e.target.checked)}
                className="accent-[#8580C4]"
              />
              <span>Also block {currentCandidate.displayName} immediately</span>
            </label>

            {reportError && (
              <p role="alert" className="text-xs text-danger">
                {reportError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setReportModalOpen(false)}
                disabled={isSubmittingReport}
                className="!bg-coal !border !border-edge"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                isLoading={isSubmittingReport}
                data-testid="submit-report-btn"
              >
                Submit Report
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
