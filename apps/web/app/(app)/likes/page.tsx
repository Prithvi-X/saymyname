'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api,
  DiscoveryCandidate,
  LikeResponse,
  ReceivedLikeItem,
  ReceivedLikesResponse,
  SentLikeItem,
  SentLikesResponse,
  ReportCategory,
} from '../../../lib/api';
import {
  getCachedQuery,
  invalidateQueryKey,
  setCachedQuery,
} from '../../../lib/query-cache';
import {
  formatProgrammeLabel,
  formatIntentionLabel,
  formatCandidateHeading,
  formatCoarseLocation,
  getInitials,
  REPORT_CATEGORY_OPTIONS,
} from '../../../lib/discover-state';
import {
  mergePaginatedByLikeId,
  removeLikeById,
  markSentLikeWithdrawn,
  formatLikesDateLabel,
  getSentLikeStatusMeta,
} from '../../../lib/likes-state';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  IntervalEmptyComposition,
  Skeleton,
  Tabs,
} from '../../../components/ui';
import {
  HeartIcon,
  XIcon,
  UserIcon,
  ShieldIcon,
  FlagIcon,
  CompassIcon,
  InboxIcon,
  SendIcon,
  LockIcon,
} from '../../../components/icons';

type LikesTab = 'received' | 'sent';

type InspectContext =
  | { source: 'received'; item: ReceivedLikeItem }
  | { source: 'sent'; item: SentLikeItem };

function getErrorStatus(err: any): number | null {
  if (typeof err?.status === 'number') return err.status;
  return null;
}

function makeActionKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function LikesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LikesTab>('received');
  const cachedReceived = getCachedQuery<ReceivedLikesResponse>('likes:received', 90_000);
  const cachedSent = getCachedQuery<SentLikesResponse>('likes:sent', 90_000);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'sent') {
        setActiveTab('sent');
      }
    }
  }, []);

  // Received Likes State
  const [receivedItems, setReceivedItems] = useState<ReceivedLikeItem[]>(() => cachedReceived?.items ?? []);
  const [receivedCursor, setReceivedCursor] = useState<string | null>(() => cachedReceived?.nextCursor ?? null);
  const [receivedHasMore, setReceivedHasMore] = useState(() => cachedReceived?.hasMore ?? false);
  const [receivedTotalActive, setReceivedTotalActive] = useState(() => cachedReceived?.totalActiveCount ?? 0);
  const [receivedViewerState, setReceivedViewerState] = useState<
    'ready' | 'paused' | 'profile_incomplete'
  >(() => cachedReceived?.viewerState ?? 'ready');
  const [receivedLoading, setReceivedLoading] = useState(() => !cachedReceived);
  const [receivedLoadingMore, setReceivedLoadingMore] = useState(false);
  const [receivedError, setReceivedError] = useState<string | null>(null);

  // Sent Likes State
  const [sentItems, setSentItems] = useState<SentLikeItem[]>(() => cachedSent?.items ?? []);
  const [sentCursor, setSentCursor] = useState<string | null>(() => cachedSent?.nextCursor ?? null);
  const [sentHasMore, setSentHasMore] = useState(() => cachedSent?.hasMore ?? false);
  const [sentTotalActive, setSentTotalActive] = useState(() => cachedSent?.totalActiveCount ?? 0);
  const [sentViewerState, setSentViewerState] = useState<
    'ready' | 'paused' | 'profile_incomplete'
  >(() => cachedSent?.viewerState ?? 'ready');
  const [sentLoading, setSentLoading] = useState(() => !cachedSent);
  const [sentLoadingMore, setSentLoadingMore] = useState(false);
  const [sentError, setSentError] = useState<string | null>(null);
  const sentLoadedOnceRef = useRef(Boolean(cachedSent));

  // Action & Feedback State
  const [inFlightByLikeId, setInFlightByLikeId] = useState<
    Record<string, 'like_back' | 'pass' | 'withdraw' | undefined>
  >({});
  const [isResuming, setIsResuming] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});

  // Inspect Full Profile Modal State
  const [inspectTarget, setInspectTarget] = useState<InspectContext | null>(null);
  const [inspectPhotoIndex, setInspectPhotoIndex] = useState(0);
  const [inspectRefreshing, setInspectRefreshing] = useState(false);

  // Mutual Match Modal State
  const [matchResult, setMatchResult] = useState<LikeResponse | null>(null);

  // Withdraw Confirmation Dialog State
  const [withdrawTarget, setWithdrawTarget] = useState<SentLikeItem | null>(null);

  // Safety Block / Report State (for received active likes)
  const [safetyTarget, setSafetyTarget] = useState<{
    likeId: string;
    profileId: string;
    displayName: string;
  } | null>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDescription, setReportDescription] = useState('');
  const [reportAlsoBlock, setReportAlsoBlock] = useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const actionKeysRef = useRef<Record<string, string>>({});

  const getOrCreateKey = (action: string, likeId: string) => {
    const slot = `${action}:${likeId}`;
    if (!actionKeysRef.current[slot]) {
      actionKeysRef.current[slot] = makeActionKey(action);
    }
    return actionKeysRef.current[slot];
  };

  const clearActionKeysForLike = (likeId: string) => {
    delete actionKeysRef.current[`like_back:${likeId}`];
    delete actionKeysRef.current[`pass:${likeId}`];
    delete actionKeysRef.current[`withdraw:${likeId}`];
  };

  const loadReceivedLikes = useCallback(async () => {
    const hasWarm = Boolean(getCachedQuery<ReceivedLikesResponse>('likes:received', 90_000));
    if (!hasWarm) setReceivedLoading(true);
    setReceivedError(null);
    try {
      const res = await api.getReceivedLikes({ limit: 12 });
      setCachedQuery('likes:received', res);
      setReceivedItems(res.items);
      setReceivedCursor(res.nextCursor);
      setReceivedHasMore(res.hasMore);
      setReceivedTotalActive(res.totalActiveCount);
      setReceivedViewerState(res.viewerState);
    } catch (err: any) {
      if (!hasWarm) {
        setReceivedError(err?.message || 'Unable to load received likes right now.');
      }
    } finally {
      setReceivedLoading(false);
    }
  }, []);

  const loadMoreReceivedLikes = useCallback(async () => {
    if (!receivedHasMore || !receivedCursor || receivedLoadingMore) return;
    setReceivedLoadingMore(true);
    setActionError(null);
    try {
      const res = await api.getReceivedLikes({ cursor: receivedCursor, limit: 12 });
      setReceivedItems((prev) => mergePaginatedByLikeId(prev, res.items));
      setReceivedCursor(res.nextCursor);
      setReceivedHasMore(res.hasMore);
      setReceivedTotalActive(res.totalActiveCount);
    } catch (err: any) {
      if (String(err?.code || '').includes('CURSOR') || String(err?.message || '').toLowerCase().includes('cursor')) {
        await loadReceivedLikes();
        return;
      }
      setActionError(err?.message || 'Unable to load additional received likes.');
    } finally {
      setReceivedLoadingMore(false);
    }
  }, [receivedHasMore, receivedCursor, receivedLoadingMore, loadReceivedLikes]);

  const loadSentLikes = useCallback(async () => {
    const hasWarm = Boolean(getCachedQuery<SentLikesResponse>('likes:sent', 90_000));
    if (!hasWarm) setSentLoading(true);
    setSentError(null);
    try {
      const res = await api.getSentLikes({ limit: 12, includeWithdrawn: true });
      sentLoadedOnceRef.current = true;
      setCachedQuery('likes:sent', res);
      setSentItems(res.items);
      setSentCursor(res.nextCursor);
      setSentHasMore(res.hasMore);
      setSentTotalActive(res.totalActiveCount);
      setSentViewerState(res.viewerState);
    } catch (err: any) {
      if (!hasWarm) {
        setSentError(err?.message || 'Unable to load sent likes right now.');
      }
    } finally {
      setSentLoading(false);
    }
  }, []);

  const loadMoreSentLikes = useCallback(async () => {
    if (!sentHasMore || !sentCursor || sentLoadingMore) return;
    setSentLoadingMore(true);
    setActionError(null);
    try {
      const res = await api.getSentLikes({
        cursor: sentCursor,
        limit: 12,
        includeWithdrawn: true,
      });
      setSentItems((prev) => mergePaginatedByLikeId(prev, res.items));
      setSentCursor(res.nextCursor);
      setSentHasMore(res.hasMore);
      setSentTotalActive(res.totalActiveCount);
    } catch (err: any) {
      if (String(err?.code || '').includes('CURSOR') || String(err?.message || '').toLowerCase().includes('cursor')) {
        await loadSentLikes();
        return;
      }
      setActionError(err?.message || 'Unable to load additional sent likes.');
    } finally {
      setSentLoadingMore(false);
    }
  }, [sentHasMore, sentCursor, sentLoadingMore, loadSentLikes]);

  useEffect(() => {
    loadReceivedLikes();
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('tab') === 'sent'
    ) {
      loadSentLikes();
    }
  }, [loadReceivedLikes, loadSentLikes]);

  const handleTabChange = (nextTab: string) => {
    const resolved: LikesTab = nextTab === 'sent' ? 'sent' : 'received';
    setActiveTab(resolved);
    setActionNotice(null);
    setActionError(null);
    if (resolved === 'sent' && !sentLoadedOnceRef.current) {
      void loadSentLikes();
    }
  };

  const handleResumeDiscovery = async () => {
    setIsResuming(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await api.publishProfile({ isPublished: true, acceptGuidelinesConsent: true });
      await api.updatePreferences({ showInDiscovery: true });
      await Promise.all([loadReceivedLikes(), loadSentLikes()]);
      setActionNotice('Your discovery visibility is now active.');
    } catch (err: any) {
      setActionError(
        err?.message || 'Could not resume discovery visibility. Review your profile first.',
      );
    } finally {
      setIsResuming(false);
    }
  };

  const handleOpenReceivedProfile = async (item: ReceivedLikeItem) => {
    setInspectPhotoIndex(0);
    setInspectTarget({ source: 'received', item });
    setInspectRefreshing(true);
    try {
      const fresh = await api.getReceivedLikeDetail(item.likeId);
      setReceivedItems((prev) =>
        prev.map((row) => (row.likeId === fresh.likeId ? fresh : row)),
      );
      setInspectTarget({ source: 'received', item: fresh });
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 404 || status === 403 || status === 409) {
        setInspectTarget(null);
        setReceivedItems((prev) => removeLikeById(prev, item.likeId));
        setReceivedTotalActive((prev) => Math.max(0, prev - 1));
        setActionNotice('This incoming like is no longer available.');
      }
    } finally {
      setInspectRefreshing(false);
    }
  };

  const handleOpenSentProfile = (item: SentLikeItem) => {
    if (item.availability !== 'pending' && item.availability !== 'withdrawn') {
      return;
    }
    if (!item.profile.profileId) return;
    setInspectPhotoIndex(0);
    setInspectTarget({ source: 'sent', item });
  };

  const handleLikeBack = async (item: ReceivedLikeItem) => {
    if (inFlightByLikeId[item.likeId]) return;
    const key = getOrCreateKey('like_back', item.likeId);
    setInFlightByLikeId((prev) => ({ ...prev, [item.likeId]: 'like_back' }));
    setActionError(null);
    setActionNotice(null);

    try {
      const res = await api.likeBackReceived(item.likeId, key);
      clearActionKeysForLike(item.likeId);
      invalidateQueryKey('likes:');
      invalidateQueryKey('matches:');
      invalidateQueryKey('chats:');
      invalidateQueryKey('discover:');
      setInspectTarget((cur) =>
        cur?.source === 'received' && cur.item.likeId === item.likeId ? null : cur,
      );
      setReceivedItems((prev) => removeLikeById(prev, item.likeId));
      setReceivedTotalActive((prev) => Math.max(0, prev - 1));

      if (res.isMutualMatch) {
        setMatchResult(res);
      } else {
        setActionNotice(`Interest confirmed for ${item.profile.displayName}.`);
      }
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 404 || status === 409) {
        clearActionKeysForLike(item.likeId);
        setInspectTarget((cur) =>
          cur?.source === 'received' && cur.item.likeId === item.likeId ? null : cur,
        );
        setReceivedItems((prev) => removeLikeById(prev, item.likeId));
        setReceivedTotalActive((prev) => Math.max(0, prev - 1));
        setActionNotice('This incoming like is no longer available.');
      } else {
        setActionError(
          err?.message || 'Unable to confirm mutual interest right now. Please retry.',
        );
      }
    } finally {
      setInFlightByLikeId((prev) => {
        const next = { ...prev };
        delete next[item.likeId];
        return next;
      });
    }
  };

  const handlePassReceived = async (item: ReceivedLikeItem) => {
    if (inFlightByLikeId[item.likeId]) return;
    const key = getOrCreateKey('pass', item.likeId);
    setInFlightByLikeId((prev) => ({ ...prev, [item.likeId]: 'pass' }));
    setActionError(null);
    setActionNotice(null);

    try {
      await api.passReceivedLike(item.likeId, key);
      clearActionKeysForLike(item.likeId);
      setInspectTarget((cur) =>
        cur?.source === 'received' && cur.item.likeId === item.likeId ? null : cur,
      );
      setReceivedItems((prev) => removeLikeById(prev, item.likeId));
      setReceivedTotalActive((prev) => Math.max(0, prev - 1));
      setActionNotice(`Passed quietly on ${item.profile.displayName}. They will not be notified.`);
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 404 || status === 409) {
        clearActionKeysForLike(item.likeId);
        setInspectTarget((cur) =>
          cur?.source === 'received' && cur.item.likeId === item.likeId ? null : cur,
        );
        setReceivedItems((prev) => removeLikeById(prev, item.likeId));
        setReceivedTotalActive((prev) => Math.max(0, prev - 1));
        setActionNotice('This incoming like is no longer available.');
      } else {
        setActionError(
          err?.message || 'Unable to record pass right now. Please retry.',
        );
      }
    } finally {
      setInFlightByLikeId((prev) => {
        const next = { ...prev };
        delete next[item.likeId];
        return next;
      });
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!withdrawTarget || inFlightByLikeId[withdrawTarget.likeId]) return;
    const target = withdrawTarget;
    const key = getOrCreateKey('withdraw', target.likeId);

    setInFlightByLikeId((prev) => ({ ...prev, [target.likeId]: 'withdraw' }));
    setActionError(null);
    setActionNotice(null);

    try {
      const res = await api.withdrawLike(target.likeId, key);
      clearActionKeysForLike(target.likeId);
      setWithdrawTarget(null);
      setInspectTarget((cur) =>
        cur?.source === 'sent' && cur.item.likeId === target.likeId ? null : cur,
      );
      setSentItems((prev) => markSentLikeWithdrawn(prev, target.likeId));
      if (!res.alreadyWithdrawn) {
        setSentTotalActive((prev) => Math.max(0, prev - 1));
      }
      setActionNotice(
        target.availability === 'pending'
          ? `Like to ${target.profile.displayName} withdrawn quietly.`
          : 'Pending like withdrawn quietly.',
      );
    } catch (err: any) {
      const status = getErrorStatus(err);
      setWithdrawTarget(null);
      if (status === 409 || status === 404) {
        setActionError(
          err?.message || 'This like can no longer be withdrawn. Refreshing your sent likes.',
        );
        await loadSentLikes();
      } else {
        setActionError(err?.message || 'Unable to withdraw this like right now. Please retry.');
      }
    } finally {
      setInFlightByLikeId((prev) => {
        const next = { ...prev };
        delete next[target.likeId];
        return next;
      });
    }
  };

  const handleConfirmBlock = async () => {
    if (!safetyTarget || isSubmittingBlock) return;
    const target = safetyTarget;
    setIsSubmittingBlock(true);
    setActionError(null);
    try {
      await api.blockCandidate(
        target.profileId,
        blockReason.trim() || 'Blocked from Likes inbox',
      );
      setBlockModalOpen(false);
      setBlockReason('');
      setInspectTarget(null);
      setSafetyTarget(null);
      setReceivedItems((prev) => removeLikeById(prev, target.likeId));
      setReceivedTotalActive((prev) => Math.max(0, prev - 1));
      setActionNotice(
        `${target.displayName} has been blocked. Neither of you will see each other in discovery or messages.`,
      );
    } catch (err: any) {
      setBlockModalOpen(false);
      setActionError(err?.message || 'Unable to complete block right now. Please retry.');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safetyTarget || isSubmittingReport) return;
    const target = safetyTarget;
    setIsSubmittingReport(true);
    setReportError(null);

    try {
      await api.reportCandidate(
        target.profileId,
        reportCategory,
        reportDescription.trim() || undefined,
      );

      let blockedToo = false;
      if (reportAlsoBlock) {
        try {
          await api.blockCandidate(target.profileId, `Reported: ${reportCategory}`);
          blockedToo = true;
        } catch {
          blockedToo = false;
        }
      }

      setReportModalOpen(false);
      setReportDescription('');
      setReportAlsoBlock(true);
      setInspectTarget(null);
      setSafetyTarget(null);
      setReceivedItems((prev) => removeLikeById(prev, target.likeId));
      setReceivedTotalActive((prev) => Math.max(0, prev - 1));
      setActionNotice(
        blockedToo
          ? 'Safety report submitted and user blocked immediately.'
          : 'Safety report submitted cleanly for moderation review.',
      );
    } catch (err: any) {
      setReportError(err?.message || 'Unable to submit report right now. Please retry.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const inspectCandidateProfile: DiscoveryCandidate | null =
    inspectTarget?.source === 'received'
      ? inspectTarget.item.profile
      : inspectTarget?.source === 'sent' && inspectTarget.item.profile.profileId
        ? ({
            profileId: inspectTarget.item.profile.profileId,
            displayName: inspectTarget.item.profile.displayName,
            age: inspectTarget.item.profile.age,
            ageVisible: inspectTarget.item.profile.ageVisible,
            programmeFamily: inspectTarget.item.profile.programmeFamily as any,
            currentTerm: inspectTarget.item.profile.currentTerm ?? undefined,
            locationCity: inspectTarget.item.profile.locationCity ?? undefined,
            locationState: inspectTarget.item.profile.locationState ?? undefined,
            intention: inspectTarget.item.profile.intention ?? undefined,
            bio: inspectTarget.item.profile.bio ?? '',
            photos: inspectTarget.item.profile.photos,
            interests: inspectTarget.item.profile.interests,
            promptAnswers: inspectTarget.item.profile.promptAnswers,
            isVerified: inspectTarget.item.profile.isVerified,
          } satisfies DiscoveryCandidate)
        : null;

  const inspectPhotos = inspectCandidateProfile?.photos || [];
  const activeInspectPhoto = inspectPhotos[inspectPhotoIndex] || inspectPhotos[0] || null;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-24 sm:pt-9 md:pb-12 flex flex-col gap-6 font-ui">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-edge/60 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ash font-semibold mb-1.5">
            <LockIcon size={13} color="var(--smn-accent-iris, #8580C4)" />
            <span>Private Interest • Two-Way Consent</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-chalk tracking-tight">
            Likes
          </h1>
          <p className="text-sm text-silver mt-1 max-w-2xl leading-relaxed">
            Review verified members who expressed interest in you, or manage pending likes you have sent.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[8px] border border-edge bg-coal text-silver text-sm font-medium hover:text-chalk hover:bg-iron transition-colors focus-visible:outline-2 focus-visible:outline-iris"
          >
            <span>Matches</span>
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[8px] border border-edge bg-iron text-chalk text-sm font-medium hover:bg-slate transition-colors focus-visible:outline-2 focus-visible:outline-iris"
          >
            <CompassIcon size={16} />
            <span>Open Discover</span>
          </Link>
        </div>
      </header>

      {/* Architectural Tabs (No pill/capsule tracks — Document 10 Section 11) */}
      <Tabs
        activeTab={activeTab}
        onChange={handleTabChange}
        tabs={[
          {
            id: 'received',
            label: 'Received Likes',
            badge: receivedTotalActive,
            icon: <InboxIcon size={15} />,
          },
          {
            id: 'sent',
            label: 'Sent Likes',
            badge: sentTotalActive,
            icon: <SendIcon size={15} />,
          },
        ]}
      />

      {/* Global Transient Notices */}
      {actionNotice && (
        <div
          role="status"
          data-testid="likes-status-notice"
          className="px-4 py-3 rounded-[8px] bg-coal border border-edge text-sm text-silver flex items-center justify-between gap-3"
        >
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs text-ash hover:text-chalk px-2 py-1 rounded-[4px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          data-testid="likes-action-error"
          className="px-4 py-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-sm text-danger flex items-center justify-between gap-3"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-danger hover:underline px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: RECEIVED LIKES */}
      {activeTab === 'received' && (
        <section aria-label="Received Likes" data-testid="received-likes-panel" className="flex flex-col gap-5">
          {receivedLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((slot) => (
                  <div
                    key={slot}
                    className="p-4 rounded-[12px] border border-edge bg-iron flex gap-4"
                  >
                    <Skeleton width="96px" height="128px" rounded="control" className="shrink-0" />
                    <div className="flex-1 flex flex-col gap-2.5">
                      <Skeleton width="60%" height="18px" />
                      <Skeleton width="85%" height="14px" />
                      <Skeleton width="45%" height="14px" />
                      <div className="flex gap-2 mt-auto pt-2">
                        <Skeleton width="88px" height="36px" rounded="control" />
                        <Skeleton width="108px" height="36px" rounded="control" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="lg:col-span-4 rounded-[12px] border border-edge bg-coal p-5 h-56 animate-pulse" />
            </div>
          ) : receivedError ? (
            <EmptyState
              title="Unable to load received likes"
              description={receivedError}
              actionLabel="Retry"
              onAction={loadReceivedLikes}
              icon={<InboxIcon size={22} />}
            />
          ) : receivedViewerState === 'paused' ? (
            <IntervalEmptyComposition
              variant="paused"
              eyebrow="Visibility Paused"
              title="Your discovery visibility is paused"
              description="While paused, incoming likes and new matching wait quietly. You can still inspect or withdraw active outgoing likes in Sent Likes."
              primaryAction={{
                label: isResuming ? 'Resuming...' : 'Resume Discovery Visibility',
                onClick: handleResumeDiscovery,
                isLoading: isResuming,
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Review Sent Likes',
                onClick: () => handleTabChange('sent'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Incoming feed', value: 'Paused until resumed' },
                { label: 'Sent likes tab', value: `${sentTotalActive} active pending` },
              ]}
            />
          ) : receivedItems.length === 0 ? (
            <IntervalEmptyComposition
              variant="likes"
              eyebrow="Incoming Queue"
              title="No incoming likes yet"
              description="Verified members who express interest in your profile appear here clearly — never blurred or paywalled. Passes and decisions remain strictly private."
              primaryAction={{
                label: 'Browse Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: `Check Sent Likes (${sentTotalActive})`,
                onClick: () => handleTabChange('sent'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Active incoming', value: '0 awaiting decision' },
                { label: 'Pending outgoing', value: `${sentTotalActive} sent` },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Primary Received Likes Grid (8 Cols Desktop) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs text-ash px-0.5">
                  <span>
                    Showing {receivedItems.length} of {receivedTotalActive} active incoming{' '}
                    {receivedTotalActive === 1 ? 'like' : 'likes'}
                  </span>
                  <span>Passes stay private</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {receivedItems.map((item) => {
                    const p = item.profile;
                    const primaryPhoto = p.photos.find((ph) => ph.isPrimary) || p.photos[0] || null;
                    const photoBroken = primaryPhoto ? Boolean(brokenPhotoIds[primaryPhoto.id]) : true;
                    const busyAction = inFlightByLikeId[item.likeId];
                    const coarseLocation = formatCoarseLocation(p.locationCity, p.locationState);
                    const firstPrompt = p.promptAnswers[0] || null;

                    return (
                      <article
                        key={item.likeId}
                        data-testid={`received-like-card-${item.likeId}`}
                        className="rounded-[12px] border border-edge bg-coal smn-surface-elevated p-4 sm:p-5 flex flex-col gap-4 transition-colors duration-150 hover:border-[#465261]"
                      >
                        <div className="flex gap-4 flex-1">
                          <button
                            type="button"
                            onClick={() => handleOpenReceivedProfile(item)}
                            aria-label={`Inspect ${p.displayName}'s full profile`}
                            className="w-24 h-32 sm:w-28 sm:h-36 rounded-[8px] border border-edge bg-stage overflow-hidden shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                          >
                            {primaryPhoto?.photoUrl && !photoBroken ? (
                              <img
                                src={primaryPhoto.photoUrl}
                                alt={`${p.displayName}'s portrait`}
                                onError={() =>
                                  setBrokenPhotoIds((prev) => ({ ...prev, [primaryPhoto.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-iron text-chalk font-semibold text-base">
                                {getInitials(p.displayName)}
                              </div>
                            )}
                          </button>

                          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="verified" size="sm">
                                Verified
                              </Badge>
                              <Badge variant="programme" size="sm">
                                {formatProgrammeLabel(p.programmeFamily)}
                              </Badge>
                            </div>

                            <div className="flex items-baseline justify-between gap-2 pt-0.5">
                              <h2 className="text-lg font-semibold text-chalk truncate">
                                {formatCandidateHeading(p.displayName, p.age)}
                              </h2>
                              <span className="text-[11px] text-ash shrink-0">
                                {formatLikesDateLabel(item.likedAt)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ash">
                              {p.currentTerm && <span>{p.currentTerm}</span>}
                              {coarseLocation && <span>{coarseLocation}</span>}
                              {!p.ageVisible && <span>Age set to private</span>}
                              {p.sharedInterests && p.sharedInterests.length > 0 && (
                                <span className="text-iris font-medium">
                                  {p.sharedInterests.length} shared{' '}
                                  {p.sharedInterests.length === 1 ? 'interest' : 'interests'}
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-silver line-clamp-2 leading-relaxed mt-0.5">
                              {p.bio?.trim()
                                ? p.bio
                                : firstPrompt
                                  ? `${firstPrompt.promptText}: ${firstPrompt.answerText}`
                                  : 'No written bio added yet.'}
                            </p>
                          </div>
                        </div>

                        {/* Actions Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-edge">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenReceivedProfile(item)}
                              disabled={Boolean(busyAction)}
                              leftIcon={<UserIcon size={15} />}
                              data-testid={`inspect-received-btn-${item.likeId}`}
                              className="border border-edge bg-iron/70 text-silver"
                            >
                              Inspect
                            </Button>

                            <button
                              type="button"
                              onClick={() => {
                                setSafetyTarget({
                                  likeId: item.likeId,
                                  profileId: item.profileId,
                                  displayName: p.displayName,
                                });
                                setBlockModalOpen(true);
                              }}
                              disabled={Boolean(busyAction)}
                              aria-label={`Block ${p.displayName}`}
                              className="inline-flex items-center gap-1 px-2.5 h-9 rounded-[6px] text-xs text-ash hover:text-danger hover:bg-iron transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                            >
                              <ShieldIcon size={14} />
                              <span className="sr-only sm:not-sr-only">Block</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePassReceived(item)}
                              disabled={Boolean(busyAction)}
                              isLoading={busyAction === 'pass'}
                              leftIcon={<XIcon size={15} />}
                              data-testid={`pass-received-btn-${item.likeId}`}
                              className="!bg-iron !border-edge"
                            >
                              Pass
                            </Button>

                            <Button
                              variant="warm"
                              size="sm"
                              onClick={() => handleLikeBack(item)}
                              disabled={Boolean(busyAction)}
                              isLoading={busyAction === 'like_back'}
                              leftIcon={<HeartIcon size={15} />}
                              data-testid={`like-back-btn-${item.likeId}`}
                            >
                              Like Back
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {receivedHasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={loadMoreReceivedLikes}
                      isLoading={receivedLoadingMore}
                      data-testid="load-more-received-btn"
                    >
                      Load More Received Likes
                    </Button>
                  </div>
                )}
              </div>

              {/* Right Contextual Consent & Queue Summary Rail (4 Cols Desktop) */}
              <aside className="lg:col-span-4 lg:sticky lg:top-[84px] flex flex-col gap-5">
                <div className="rounded-[12px] border border-edge bg-coal smn-surface-elevated p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-edge">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">
                      Inbox Overview
                    </span>
                    <Badge variant="verified" size="sm">
                      Two-Way Only
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[8px] bg-iron border border-edge p-3 flex flex-col gap-1">
                      <span className="text-[11px] text-ash uppercase tracking-wider">Incoming</span>
                      <span className="text-xl font-semibold text-chalk">{receivedTotalActive}</span>
                    </div>
                    <div className="rounded-[8px] bg-iron border border-edge p-3 flex flex-col gap-1">
                      <span className="text-[11px] text-ash uppercase tracking-wider">Sent Active</span>
                      <span className="text-xl font-semibold text-chalk">{sentTotalActive}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 text-xs text-silver leading-relaxed pt-1">
                    <p>
                      <span className="text-chalk font-medium">Liking back</span> creates a mutual match immediately and unlocks private conversation in Chats.
                    </p>
                    <p>
                      <span className="text-chalk font-medium">Passing</span> quietly closes incoming interest without notifying the other student.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-edge">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTabChange('sent')}
                      className="w-full"
                    >
                      Review Pending Sent Likes ({sentTotalActive})
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: SENT LIKES */}
      {activeTab === 'sent' && (
        <section aria-label="Sent Likes" data-testid="sent-likes-panel" className="flex flex-col gap-5">
          {sentViewerState === 'paused' && !sentLoading && (
            <div className="px-4 py-3 rounded-[8px] border border-edge bg-coal flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-silver">
                <span className="font-medium text-chalk">Discovery is paused.</span> You can still review and withdraw pending outgoing likes below.
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResumeDiscovery}
                isLoading={isResuming}
              >
                Resume Visibility
              </Button>
            </div>
          )}

          {sentLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  className="p-4 rounded-[12px] border border-edge bg-iron flex items-center gap-4"
                >
                  <Skeleton width="72px" height="84px" rounded="control" className="shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton width="42%" height="18px" />
                    <Skeleton width="68%" height="14px" />
                  </div>
                  <Skeleton width="104px" height="36px" rounded="control" />
                </div>
              ))}
            </div>
          ) : sentError ? (
            <EmptyState
              title="Unable to load sent likes"
              description={sentError}
              actionLabel="Retry"
              onAction={loadSentLikes}
              icon={<SendIcon size={22} />}
            />
          ) : sentItems.length === 0 ? (
            <IntervalEmptyComposition
              variant="likes"
              eyebrow="Sent Interest"
              title="No pending sent likes"
              description="Profiles you like in Discover appear here while awaiting a mutual decision. Withdrawing cancels pending interest cleanly without alerting anyone."
              primaryAction={{
                label: 'Browse Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: `Check Received Likes (${receivedTotalActive})`,
                onClick: () => handleTabChange('received'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Pending outgoing', value: '0 awaiting response' },
                { label: 'Incoming awaiting you', value: `${receivedTotalActive} likes` },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Primary Sent Likes Stack (8 Cols Desktop) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs text-ash px-0.5">
                  <span>
                    {sentTotalActive} active {sentTotalActive === 1 ? 'pending like' : 'pending likes'}
                  </span>
                  <span>Mutual matches move to Matches automatically</span>
                </div>

                <div className="flex flex-col gap-3">
                  {sentItems.map((item) => {
                    const meta = getSentLikeStatusMeta(item);
                    const busyAction = inFlightByLikeId[item.likeId];
                    const isUnavailable = item.availability === 'unavailable';
                    const isWithdrawn = item.availability === 'withdrawn';
                    const p = item.profile;
                    const primaryPhoto = p.photos.find((ph) => ph.isPrimary) || p.photos[0] || null;
                    const photoBroken = primaryPhoto ? Boolean(brokenPhotoIds[primaryPhoto.id]) : true;

                    return (
                      <article
                        key={item.likeId}
                        data-testid={`sent-like-row-${item.likeId}`}
                        className={`rounded-[12px] border border-edge p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-150 ${
                          isWithdrawn
                            ? 'bg-stage/80 border-edge/60 opacity-75'
                            : isUnavailable
                              ? 'bg-coal/75 border-edge/70'
                              : 'bg-coal smn-surface-elevated hover:border-[#465261]'
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-[8px] border border-edge bg-stage overflow-hidden shrink-0 flex items-center justify-center">
                            {!isUnavailable && primaryPhoto?.photoUrl && !photoBroken ? (
                              <img
                                src={primaryPhoto.photoUrl}
                                alt={`${p.displayName}'s portrait`}
                                onError={() =>
                                  setBrokenPhotoIds((prev) => ({ ...prev, [primaryPhoto.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-ash">
                                {isUnavailable ? '—' : getInitials(p.displayName)}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={meta.badgeVariant} size="sm">
                                {meta.label}
                              </Badge>
                              {!isUnavailable && p.programmeFamily && (
                                <Badge variant="programme" size="sm">
                                  {formatProgrammeLabel(p.programmeFamily)}
                                </Badge>
                              )}
                            </div>

                            <h2 className="text-base sm:text-lg font-semibold text-chalk truncate">
                              {isUnavailable
                                ? 'Member unavailable'
                                : formatCandidateHeading(p.displayName, p.age)}
                            </h2>

                            <p className="text-xs text-silver leading-relaxed">
                              {meta.helperCopy}
                            </p>

                            <span className="text-xs text-ash">
                              Sent {formatLikesDateLabel(item.sentAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-edge">
                          {!isUnavailable && p.profileId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSentProfile(item)}
                              leftIcon={<UserIcon size={15} />}
                              className="border border-edge bg-iron/70 text-silver"
                            >
                              View Profile
                            </Button>
                          )}

                          {item.canWithdraw && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setWithdrawTarget(item)}
                              disabled={Boolean(busyAction)}
                              isLoading={busyAction === 'withdraw'}
                              data-testid={`withdraw-like-btn-${item.likeId}`}
                              className="!bg-iron !border-edge hover:!border-warning/60 hover:!text-warning"
                            >
                              Withdraw
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {sentHasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={loadMoreSentLikes}
                      isLoading={sentLoadingMore}
                      data-testid="load-more-sent-btn"
                    >
                      Load More Sent Likes
                    </Button>
                  </div>
                )}
              </div>

              {/* Right Contextual Sent-State Guide Rail (4 Cols Desktop) */}
              <aside className="lg:col-span-4 lg:sticky lg:top-[84px] flex flex-col gap-5">
                <div className="rounded-[12px] border border-edge bg-coal smn-surface-elevated p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-edge">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">
                      Outgoing Status Guide
                    </span>
                    <Badge variant="neutral" size="sm">
                      Private
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[8px] bg-iron border border-edge p-3 flex flex-col gap-1">
                      <span className="text-[11px] text-ash uppercase tracking-wider">Pending</span>
                      <span className="text-xl font-semibold text-chalk">{sentTotalActive}</span>
                    </div>
                    <div className="rounded-[8px] bg-iron border border-edge p-3 flex flex-col gap-1">
                      <span className="text-[11px] text-ash uppercase tracking-wider">Incoming</span>
                      <span className="text-xl font-semibold text-chalk">{receivedTotalActive}</span>
                    </div>
                  </div>

                  <ul className="flex flex-col gap-2.5 text-xs text-silver leading-relaxed">
                    <li>
                      <span className="text-chalk font-medium">Awaiting decision:</span> Your interest is active and can be withdrawn anytime before mutual match.
                    </li>
                    <li>
                      <span className="text-chalk font-medium">Withdrawn:</span> Cancelled quietly; the member can no longer act on the earlier like.
                    </li>
                    <li>
                      <span className="text-chalk font-medium">Member unavailable:</span> Account paused, removed, or restricted.
                    </li>
                  </ul>

                  <div className="pt-2 border-t border-edge">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTabChange('received')}
                      className="w-full"
                    >
                      View Received Likes ({receivedTotalActive})
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>
      )}

      {/* Full Profile Inspection Modal */}
      {inspectTarget && inspectCandidateProfile && (
        <Dialog
          isOpen={Boolean(inspectTarget)}
          onClose={() => setInspectTarget(null)}
          title={formatCandidateHeading(
            inspectCandidateProfile.displayName,
            inspectCandidateProfile.age,
          )}
          description={
            inspectTarget.source === 'received'
              ? `Liked your profile ${formatLikesDateLabel(inspectTarget.item.likedAt)}`
              : `Interest sent ${formatLikesDateLabel(inspectTarget.item.sentAt)}`
          }
          maxWidth="lg"
          footer={
            inspectTarget.source === 'received' ? (
              <div className="w-full flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectTarget.item;
                      setInspectTarget(null);
                      setSafetyTarget({
                        likeId: target.likeId,
                        profileId: target.profileId,
                        displayName: target.profile.displayName,
                      });
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
                      const target = inspectTarget.item;
                      setInspectTarget(null);
                      setSafetyTarget({
                        likeId: target.likeId,
                        profileId: target.profileId,
                        displayName: target.profile.displayName,
                      });
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
                    onClick={() => handlePassReceived(inspectTarget.item)}
                    isLoading={inFlightByLikeId[inspectTarget.item.likeId] === 'pass'}
                    disabled={Boolean(inFlightByLikeId[inspectTarget.item.likeId])}
                    leftIcon={<XIcon size={15} />}
                    className="!bg-coal !border !border-edge"
                  >
                    Pass
                  </Button>
                  <Button
                    variant="warm"
                    size="sm"
                    onClick={() => handleLikeBack(inspectTarget.item)}
                    isLoading={inFlightByLikeId[inspectTarget.item.likeId] === 'like_back'}
                    disabled={Boolean(inFlightByLikeId[inspectTarget.item.likeId])}
                    leftIcon={<HeartIcon size={15} />}
                  >
                    Like Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-end gap-2.5">
                {inspectTarget.item.canWithdraw && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const item = inspectTarget.item;
                      setInspectTarget(null);
                      setWithdrawTarget(item);
                    }}
                    className="!bg-coal !border !border-edge hover:!text-warning"
                  >
                    Withdraw Like
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setInspectTarget(null)}
                >
                  Close
                </Button>
              </div>
            )
          }
        >
          <div
            data-testid="likes-full-profile-modal"
            className="max-h-[64vh] overflow-y-auto pr-1 flex flex-col gap-5"
          >
            {inspectRefreshing && (
              <p className="text-xs text-ash">Refreshing live profile availability...</p>
            )}

            <div className="border border-edge bg-coal rounded-[8px] overflow-hidden flex flex-col">
              <div className="relative aspect-[16/9] bg-stage overflow-hidden">
                {activeInspectPhoto?.photoUrl && !brokenPhotoIds[activeInspectPhoto.id] ? (
                  <img
                    src={activeInspectPhoto.photoUrl}
                    alt={`${inspectCandidateProfile.displayName} photo ${inspectPhotoIndex + 1}`}
                    onError={() =>
                      setBrokenPhotoIds((prev) => ({
                        ...prev,
                        [activeInspectPhoto.id]: true,
                      }))
                    }
                    className="w-full h-full object-contain bg-stage"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-iron text-chalk font-semibold text-xl">
                    {getInitials(inspectCandidateProfile.displayName)}
                  </div>
                )}
              </div>

              {inspectPhotos.length > 1 && (
                <div className="flex gap-1.5 p-2 bg-coal border-t border-edge overflow-x-auto">
                  {inspectPhotos.map((ph, idx) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() => setInspectPhotoIndex(idx)}
                      className={`px-2.5 py-1 rounded-[4px] text-xs border transition-colors ${
                        idx === inspectPhotoIndex
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
                {formatProgrammeLabel(inspectCandidateProfile.programmeFamily)}
              </Badge>
              {inspectCandidateProfile.currentTerm && (
                <Badge variant="neutral" size="sm">
                  {inspectCandidateProfile.currentTerm}
                </Badge>
              )}
              {formatCoarseLocation(
                inspectCandidateProfile.locationCity,
                inspectCandidateProfile.locationState,
              ) && (
                <Badge variant="neutral" size="sm">
                  {formatCoarseLocation(
                    inspectCandidateProfile.locationCity,
                    inspectCandidateProfile.locationState,
                  )}
                </Badge>
              )}
            </div>

            {formatIntentionLabel(inspectCandidateProfile.intention) && (
              <p className="text-xs text-silver">
                Intention:{' '}
                <strong className="text-chalk font-medium">
                  {formatIntentionLabel(inspectCandidateProfile.intention)}
                </strong>
              </p>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ash mb-1.5">
                Biography
              </h3>
              <p className="text-sm text-chalk leading-relaxed whitespace-pre-line">
                {inspectCandidateProfile.bio?.trim() || 'No written biography provided.'}
              </p>
            </div>

            {inspectCandidateProfile.promptAnswers.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ash">
                  Prompts
                </h3>
                {inspectCandidateProfile.promptAnswers.map((pa, idx) => (
                  <div key={pa.id || idx} className="p-3 rounded-[8px] bg-coal border border-edge">
                    <p className="text-xs text-iris font-medium mb-1">{pa.promptText}</p>
                    <p className="text-sm text-chalk">{pa.answerText}</p>
                  </div>
                ))}
              </div>
            )}

            {inspectCandidateProfile.interests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ash mb-2">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {inspectCandidateProfile.interests.map((interest) => (
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

      {/* Withdraw Confirmation Dialog */}
      {withdrawTarget && (
        <Dialog
          isOpen={Boolean(withdrawTarget)}
          onClose={() => setWithdrawTarget(null)}
          title={
            withdrawTarget.availability === 'unavailable'
              ? 'Withdraw pending like?'
              : `Withdraw like to ${withdrawTarget.profile.displayName}?`
          }
          description="Only pending outgoing likes can be withdrawn before a mutual match forms."
          maxWidth="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWithdrawTarget(null)}
                disabled={Boolean(inFlightByLikeId[withdrawTarget.likeId])}
                className="!bg-coal !border !border-edge"
              >
                Keep Like
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmWithdraw}
                isLoading={inFlightByLikeId[withdrawTarget.likeId] === 'withdraw'}
                data-testid="confirm-withdraw-btn"
              >
                Withdraw Like
              </Button>
            </>
          }
        >
          <p className="text-sm text-silver leading-relaxed">
            No notification will be sent. Retracting prevents an unexpected match if they have not responded yet.
          </p>
        </Dialog>
      )}

      {/* Mutual Match Interval Celebration Modal */}
      <Dialog
        isOpen={Boolean(matchResult)}
        onClose={() => setMatchResult(null)}
        title="It is a mutual match"
        description="You both independently said yes. Your private conversation is now open."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMatchResult(null)}
              className="!bg-coal !border !border-edge hover:!bg-slate"
            >
              Keep Reviewing
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMatchResult(null);
                router.push('/matches');
              }}
              className="!bg-coal !border !border-edge hover:!bg-slate"
            >
              Matches
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setMatchResult(null);
                router.push('/chats');
              }}
              data-testid="likes-match-open-chat-btn"
            >
              Open Conversation
            </Button>
          </>
        }
      >
        <div
          data-testid="likes-mutual-match-modal"
          className="flex flex-col items-center text-center gap-4 py-2"
        >
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
            Calm, intentional pacing — send a note whenever both of you are ready.
          </p>
        </div>
      </Dialog>

      {/* Block Confirmation Modal */}
      {safetyTarget && (
        <Dialog
          isOpen={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          title={`Block ${safetyTarget.displayName}?`}
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
                data-testid="likes-confirm-block-btn"
              >
                Block Permanently
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-silver">
              Blocking removes {safetyTarget.displayName} from your Likes, Discover, and future matches immediately.
            </p>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Optional private note for your safety record..."
              rows={2}
              maxLength={300}
              className="w-full p-2.5 rounded-[8px] bg-coal border border-edge text-sm text-chalk placeholder:text-ash focus-visible:outline-2 focus-visible:outline-iris"
            />
          </div>
        </Dialog>
      )}

      {/* Report Modal */}
      {safetyTarget && (
        <Dialog
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          title={`Report ${safetyTarget.displayName}`}
          description="Reports are reviewed confidentially by Trust & Safety."
          maxWidth="md"
        >
          <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-ash">
                Select safety concern
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {REPORT_CATEGORY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-[8px] border cursor-pointer transition-colors ${
                      reportCategory === opt.value
                        ? 'bg-slate border-iris text-chalk'
                        : 'bg-coal border-edge text-silver hover:border-[#465261]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="likesReportCategory"
                      value={opt.value}
                      checked={reportCategory === opt.value}
                      onChange={() => setReportCategory(opt.value)}
                      className="mt-0.5 accent-[#8580C4]"
                    />
                    <span className="text-xs">
                      <strong className="block font-medium text-chalk">{opt.label}</strong>
                      <span className="text-ash">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Describe relevant context (optional)..."
              rows={3}
              maxLength={800}
              className="w-full p-2.5 rounded-[8px] bg-coal border border-edge text-sm text-chalk placeholder:text-ash focus-visible:outline-2 focus-visible:outline-iris"
            />

            <label className="flex items-center gap-2 text-xs text-silver cursor-pointer">
              <input
                type="checkbox"
                checked={reportAlsoBlock}
                onChange={(e) => setReportAlsoBlock(e.target.checked)}
                className="accent-[#8580C4]"
              />
              <span>Also block {safetyTarget.displayName} immediately</span>
            </label>

            {reportError && <p className="text-xs text-danger">{reportError}</p>}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-edge">
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
              >
                Submit Report
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
