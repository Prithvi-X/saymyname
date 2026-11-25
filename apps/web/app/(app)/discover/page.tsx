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
import { Badge, Button, Dialog, EmptyState } from '../../../components/ui';
import {
  CompassIcon,
  FlagIcon,
  HeartIcon,
  LockIcon,
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
    <main className="min-h-[calc(100vh-64px)] bg-stage text-chalk smn-ambient-discover smn-stage-wrap">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-28 md:pb-10">
        {/* Top Architectural Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 mb-5 border-b border-edge">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-block w-2 h-2 bg-iris" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">
                Discover
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-chalk tracking-tight">
              Verified Peers
            </h1>
            <p className="text-sm text-silver mt-1">
              Reciprocal matches within the four approved IIT Madras non-campus BS programmes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[6px] bg-coal border border-edge text-xs font-medium text-silver hover:text-chalk hover:bg-iron transition-colors"
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
              className="text-xs text-ash hover:text-chalk px-2 py-1 rounded-[4px]"
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
            <div className="lg:col-span-7 bg-coal border border-edge rounded-[12px] overflow-hidden animate-pulse">
              <div className="aspect-[4/4.3] max-h-[540px] w-full bg-iron" />
              <div className="p-5 flex flex-col gap-3">
                <div className="h-6 w-48 bg-slate rounded-[4px]" />
                <div className="h-4 w-64 bg-slate rounded-[4px]" />
                <div className="h-12 w-full bg-iron border border-edge rounded-[8px] mt-2" />
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-4 animate-pulse">
              <div className="h-36 bg-coal border border-edge rounded-[12px]" />
              <div className="h-48 bg-coal border border-edge rounded-[12px]" />
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
          <div
            data-testid="discover-paused-state"
            className="max-w-xl mx-auto bg-coal border border-edge rounded-[12px] p-7 sm:p-9 text-center flex flex-col items-center gap-4"
          >
            <div className="w-12 h-12 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-warning">
              <LockIcon size={22} />
            </div>
            <Badge variant="warning">Discovery Paused</Badge>
            <h2 className="text-xl font-semibold text-chalk">
              Your profile visibility is currently paused
            </h2>
            <p className="text-sm text-silver leading-relaxed max-w-md">
              You are hidden from other members&apos; Discover feeds and cannot send new Likes while paused. Your existing mutual matches and conversations remain safe.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                isLoading={isResuming}
                onClick={handleResumeDiscovery}
                data-testid="resume-discovery-btn"
              >
                Resume Discovery
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push('/profile')}
              >
                Edit Profile &amp; Filters
              </Button>
            </div>
          </div>
        ) : viewerState === 'profile_incomplete' ? (
          <EmptyState
            title="Complete your profile before browsing"
            description="Publish your verified display name, at least one portrait photo, and community consent on your Profile before viewing peers."
            actionLabel="Open Profile Readiness"
            onAction={() => router.push('/profile')}
            icon={<UserIcon size={22} />}
          />
        ) : !currentCandidate ? (
          <div
            data-testid="discover-empty-state"
            className="max-w-xl mx-auto bg-coal border border-edge rounded-[12px] p-7 sm:p-9 text-center flex flex-col items-center gap-4"
          >
            <div className="w-12 h-12 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-iris">
              <CompassIcon size={22} />
            </div>
            <h2 className="text-xl font-semibold text-chalk">
              No more verified peers match right now
            </h2>
            <p className="text-sm text-silver leading-relaxed max-w-md">
              {isNarrowFilters
                ? 'You have reached the end of your current reciprocal matches. Broadening your age range or programme filters in Profile can surface more verified peers.'
                : 'You have reviewed everyone currently matching your reciprocal age and programme preferences. New verified students join regularly.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push('/profile')}
              >
                Adjust Filters
              </Button>
              <Button
                variant="tertiary"
                size="md"
                onClick={loadInitialFeed}
              >
                Refresh Feed
              </Button>
            </div>
          </div>
        ) : (
          /* Main Active Candidate Experience */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Media & Interaction Card (Left 7 Cols on Desktop) */}
            <section
              aria-label="Current discovery candidate"
              data-testid="discover-candidate-card"
              className="lg:col-span-7 bg-coal border border-edge rounded-[12px] overflow-hidden flex flex-col smn-surface-elevated"
            >
              {/* Action Error Preserve & Retry Banner */}
              {actionError && actionError.profileId === currentCandidate.profileId && (
                <div
                  role="alert"
                  className="px-4 py-3 bg-[#301618] border-b border-danger/40 flex flex-wrap items-center justify-between gap-3 text-sm text-danger"
                >
                  <span>{actionError.message}</span>
                  <div className="flex items-center gap-2">
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
                </div>
              )}

              {/* Architectural Portrait Frame (0px internal frame radius per Document 10) */}
              <div
                className="relative w-full aspect-[4/3.6] max-h-[420px] sm:max-h-[450px] bg-stage overflow-hidden select-none"
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
                          idx === photoIndex ? 'bg-chalk' : 'bg-edge/80 hover:bg-silver/60'
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
                    <p className="text-xs text-ash uppercase tracking-widest">
                      Portrait unavailable
                    </p>
                  </div>
                )}

                {/* Subtle Bottom Readability Gradient */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0B0D10]/90 via-[#0B0D10]/45 to-transparent"
                  aria-hidden="true"
                />

                {/* Previous / Next Photo Overlay Controls */}
                {candidatePhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevPhoto}
                      aria-label="Previous photo"
                      data-testid="photo-prev-btn"
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-[6px] smn-glass-control text-chalk flex items-center justify-center hover:bg-iron/85 hover:border-white/20 transition-all duration-150"
                    >
                      <span aria-hidden="true" className="text-sm font-semibold">
                        &lsaquo;
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextPhoto}
                      aria-label="Next photo"
                      data-testid="photo-next-btn"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-[6px] smn-glass-control text-chalk flex items-center justify-center hover:bg-iron/85 hover:border-white/20 transition-all duration-150"
                    >
                      <span aria-hidden="true" className="text-sm font-semibold">
                        &rsaquo;
                      </span>
                    </button>
                  </>
                )}

                {/* Bottom Overlay Badges: Verified + Photo Count */}
                <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="verified" size="sm">
                      Verified
                    </Badge>
                    <Badge variant="programme" size="sm">
                      {formatProgrammeLabel(currentCandidate.programmeFamily)}
                    </Badge>
                  </div>

                  {candidatePhotos.length > 0 && (
                    <span className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded-[4px] smn-glass-control text-[11px] font-mono text-silver">
                      {photoIndex + 1} / {candidatePhotos.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Candidate Identity & Action Dock */}
              <div className="p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2
                      data-testid="candidate-heading"
                      className="text-2xl font-semibold text-chalk tracking-tight"
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
                      className="text-xs font-medium text-iris hover:text-[#9894D1] underline underline-offset-4 py-1"
                    >
                      Full Profile &rarr;
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ash">
                    {currentCandidate.currentTerm && (
                      <span>{currentCandidate.currentTerm}</span>
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
                    {formatIntentionLabel(currentCandidate.intention) && (
                      <span className="text-silver">
                        Looking for: {formatIntentionLabel(currentCandidate.intention)}
                      </span>
                    )}
                    {!currentCandidate.ageVisible && (
                      <span className="text-ash">Age set to private</span>
                    )}
                  </div>
                </div>

                {/* Primary Explicit Actions (Pass / Full Profile / Like) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handlePass}
                    disabled={Boolean(activeAction)}
                    isLoading={activeAction === 'pass'}
                    data-testid="pass-btn"
                    leftIcon={<XIcon size={18} />}
                    className="sm:col-span-4"
                  >
                    Pass
                  </Button>

                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleOpenFullProfile}
                    disabled={Boolean(activeAction)}
                    data-testid="view-profile-btn"
                    leftIcon={<UserIcon size={17} />}
                    className="sm:col-span-4 border border-edge bg-iron/50"
                  >
                    Profile
                  </Button>

                  <Button
                    variant="warm"
                    size="lg"
                    onClick={handleLike}
                    disabled={Boolean(activeAction)}
                    isLoading={activeAction === 'like'}
                    data-testid="like-btn"
                    leftIcon={<HeartIcon size={18} />}
                    className="sm:col-span-4"
                  >
                    Like
                  </Button>
                </div>

                {/* Explicit Safety Strip */}
                <div className="flex items-center justify-between pt-3 border-t border-edge text-xs text-ash">
                  <span>Private choice — passes remain invisible</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReportError(null);
                        setReportModalOpen(true);
                      }}
                      data-testid="report-open-btn"
                      className="inline-flex items-center gap-1.5 text-ash hover:text-warning transition-colors py-1"
                    >
                      <FlagIcon size={14} />
                      <span>Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockModalOpen(true)}
                      data-testid="block-open-btn"
                      className="inline-flex items-center gap-1.5 text-ash hover:text-danger transition-colors py-1"
                    >
                      <ShieldIcon size={14} />
                      <span>Block</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Right Context Rail (5 Cols Desktop, Stacks Below on Mobile) */}
            <aside className="lg:col-span-5 flex flex-col gap-5">
              {/* Biography Panel */}
              <div className="bg-coal border border-edge rounded-[12px] p-5 smn-surface-elevated flex flex-col gap-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ash">
                  About
                </span>
                <p className="text-sm text-silver leading-relaxed whitespace-pre-line">
                  {currentCandidate.bio?.trim()
                    ? currentCandidate.bio
                    : 'No written biography added yet.'}
                </p>
              </div>

              {/* Conversation Prompts */}
              {currentCandidate.promptAnswers.length > 0 && (
                <div className="bg-coal border border-edge rounded-[12px] p-5 smn-surface-elevated flex flex-col gap-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ash">
                    Conversation Prompts
                  </span>
                  <div className="flex flex-col gap-3">
                    {currentCandidate.promptAnswers.map((pa, idx) => (
                      <div
                        key={pa.id || `${currentCandidate.profileId}-p-${idx}`}
                        className="p-3.5 rounded-[8px] bg-iron border border-edge/80"
                      >
                        <p className="text-xs font-medium text-iris mb-1">
                          {pa.promptText}
                        </p>
                        <p className="text-sm text-chalk leading-relaxed">
                          &ldquo;{pa.answerText}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interests & Shared Context */}
              {currentCandidate.interests.length > 0 && (
                <div className="bg-coal border border-edge rounded-[12px] p-5 smn-surface-elevated flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ash">
                      Interests
                    </span>
                    {currentCandidate.sharedInterests &&
                      currentCandidate.sharedInterests.length > 0 && (
                        <span className="text-[11px] text-iris font-medium">
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
                          className={`inline-flex items-center px-2.5 py-1 rounded-[4px] text-xs font-medium border ${
                            isShared
                              ? 'bg-[#1C1C2E] border-iris/50 text-chalk'
                              : 'bg-iron border-edge text-silver'
                          }`}
                        >
                          {interest}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discovery Session Batch & Filter Context */}
              <div className="bg-coal border border-edge rounded-[12px] p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 text-xs text-silver">
                  <span>In active batch: {queue.length}</span>
                  {appliedPrefs && (
                    <span className="text-ash">
                      Age {appliedPrefs.minAge}&ndash;{appliedPrefs.maxAge}
                    </span>
                  )}
                </div>

                {hasMore && nextCursor && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadNextBatch}
                    isLoading={isLoadingMore}
                    data-testid="load-more-btn"
                    className="w-full"
                  >
                    Load Next Batch
                  </Button>
                )}
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

      {/* Mutual Match Interval Celebration Modal (Document 10 Interval Signature) */}
      <Dialog
        isOpen={Boolean(matchResult)}
        onClose={() => setMatchResult(null)}
        title="It is a mutual match"
        description="You both expressed interest independently. Private conversation is now open."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMatchResult(null)}
              className="!bg-coal !border !border-edge hover:!bg-slate"
            >
              Keep Discovering
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setMatchResult(null);
                router.push('/chats');
              }}
              data-testid="match-open-chat-btn"
            >
              Open Conversation
            </Button>
          </>
        }
      >
        <div data-testid="mutual-match-modal" className="flex flex-col items-center text-center gap-4 py-2">
          {/* Document 10 Interval Architectural Alignment Mark (Zero Confetti) */}
          <div className="flex items-center justify-center gap-3 py-2" aria-hidden="true">
            <div className="w-10 h-14 border-l-2 border-t-2 border-b-2 border-iris rounded-l-[4px] bg-stage/60" />
            <div className="w-2.5 h-2.5 bg-ember" />
            <div className="w-10 h-14 border-r-2 border-t-2 border-b-2 border-ember rounded-r-[4px] bg-stage/60" />
          </div>

          {matchResult?.matchedProfile && (
            <div className="w-full p-4 rounded-[8px] bg-coal border border-edge flex items-center gap-3.5 text-left">
              <div className="w-12 h-12 rounded-[6px] bg-slate border border-edge overflow-hidden shrink-0 flex items-center justify-center text-sm font-semibold text-chalk">
                {matchResult.matchedProfile.primaryPhotoUrl ? (
                  <img
                    src={matchResult.matchedProfile.primaryPhotoUrl}
                    alt={matchResult.matchedProfile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(matchResult.matchedProfile.displayName)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-chalk truncate">
                  {matchResult.matchedProfile.displayName}
                </p>
                <p className="text-xs text-silver truncate">
                  {formatProgrammeLabel(matchResult.matchedProfile.programmeFamily)}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-ash leading-relaxed">
            No unread pressure or automated prompts. Say hello whenever both of you are ready.
          </p>
        </div>
      </Dialog>

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
