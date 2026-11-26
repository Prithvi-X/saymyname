'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, MatchProfile, ReportCategory } from '../../../lib/api';
import {
  formatCandidateHeading,
  formatCoarseLocation,
  formatIntentionLabel,
  formatProgrammeLabel,
  getInitials,
  REPORT_CATEGORY_OPTIONS,
} from '../../../lib/discover-state';
import {
  buildChatHrefForMatch,
  filterMatchesByQuery,
  formatMatchDate,
  getUnmatchDialogContent,
  MatchesEmptyKind,
  removeMatchById,
  selectActiveMatch,
} from '../../../lib/matches-state';
import {
  Badge,
  Button,
  Dialog,
  IntervalEmptyComposition,
  PageHeader,
  Skeleton,
  StructuredListRow,
} from '../../../components/ui';
import {
  ChatIcon,
  CompassIcon,
  FlagIcon,
  HeartIcon,
  ShieldIcon,
  UserIcon,
  XIcon,
} from '../../../components/icons';

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

export default function MatchesPage() {
  const router = useRouter();

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emptyKind, setEmptyKind] = useState<MatchesEmptyKind>('initial');

  // Detail & Gallery State
  const [workbenchPhotoIndex, setWorkbenchPhotoIndex] = useState(0);
  const [mobileDetailMatch, setMobileDetailMatch] = useState<MatchProfile | null>(null);
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0);
  const [refreshingMatchId, setRefreshingMatchId] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});

  // Notices
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Separate Unmatch Confirmation State
  const [unmatchTarget, setUnmatchTarget] = useState<MatchProfile | null>(null);
  const [unmatchReason, setUnmatchReason] = useState('');
  const [isUnmatching, setIsUnmatching] = useState(false);

  // Separate Block Confirmation State
  const [blockTarget, setBlockTarget] = useState<MatchProfile | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Separate Safety Report State
  const [reportTarget, setReportTarget] = useState<MatchProfile | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDescription, setReportDescription] = useState('');
  const [reportAlsoBlock, setReportAlsoBlock] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const actionKeysRef = useRef<Record<string, string>>({});

  const getOrCreateActionKey = (prefix: string, id: string) => {
    const slot = `${prefix}:${id}`;
    if (!actionKeysRef.current[slot]) {
      actionKeysRef.current[slot] = makeActionKey(prefix);
    }
    return actionKeysRef.current[slot];
  };

  const clearActionKey = (prefix: string, id: string) => {
    delete actionKeysRef.current[`${prefix}:${id}`];
  };

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.getMatches();
      setMatches(list);
      setEmptyKind('initial');
      setSelectedMatchId((prev) => selectActiveMatch(list, prev)?.id ?? null);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load mutual matches right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const selectedMatch = selectActiveMatch(matches, selectedMatchId);
  const filteredMatches = filterMatchesByQuery(matches, searchQuery);

  // Sync live match detail when user selects a match (evicts stale ended/blocked/ineligible rows immediately)
  const verifyAndSelectMatch = async (match: MatchProfile, openModal = false) => {
    setSelectedMatchId(match.id);
    setWorkbenchPhotoIndex(0);
    setActionError(null);
    if (openModal) {
      setMobilePhotoIndex(0);
      setMobileDetailMatch(match);
    }
    setRefreshingMatchId(match.id);
    try {
      const fresh = await api.getMatchDetail(match.id);
      setMatches((prev) => prev.map((row) => (row.id === fresh.id ? fresh : row)));
      if (openModal) {
        setMobileDetailMatch(fresh);
      }
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 403 || status === 404) {
        setMatches((prev) => {
          const remaining = removeMatchById(prev, match.id);
          setSelectedMatchId(selectActiveMatch(remaining, null)?.id ?? null);
          if (remaining.length === 0) {
            setEmptyKind('unavailable');
          }
          return remaining;
        });
        setMobileDetailMatch((cur) => (cur?.id === match.id ? null : cur));
        setNotice('This connection is no longer active and has been removed from your active matches.');
      }
    } finally {
      setRefreshingMatchId(null);
    }
  };

  const handleConfirmUnmatch = async () => {
    if (!unmatchTarget || isUnmatching) return;
    const target = unmatchTarget;
    const key = getOrCreateActionKey('unmatch', target.id);

    setIsUnmatching(true);
    setActionError(null);
    setNotice(null);

    try {
      const res = await api.unmatch(
        target.id,
        unmatchReason.trim() || 'Ended by member from Matches',
        key,
      );
      clearActionKey('unmatch', target.id);
      setUnmatchTarget(null);
      setUnmatchReason('');
      setMobileDetailMatch((cur) => (cur?.id === target.id ? null : cur));

      setMatches((prev) => {
        const remaining = removeMatchById(prev, target.id);
        setSelectedMatchId(selectActiveMatch(remaining, null)?.id ?? null);
        if (remaining.length === 0) {
          setEmptyKind('just_ended');
        }
        return remaining;
      });

      setNotice(
        res.alreadyEnded
          ? `Your connection with ${target.candidate.displayName} had already ended.`
          : `Unmatched ${target.candidate.displayName}. Private conversation is now closed; no safety block was applied.`,
      );
    } catch (err: any) {
      const status = getErrorStatus(err);
      if (status === 403 || status === 404) {
        clearActionKey('unmatch', target.id);
        setUnmatchTarget(null);
        setMobileDetailMatch((cur) => (cur?.id === target.id ? null : cur));
        setMatches((prev) => {
          const remaining = removeMatchById(prev, target.id);
          setSelectedMatchId(selectActiveMatch(remaining, null)?.id ?? null);
          if (remaining.length === 0) {
            setEmptyKind('unavailable');
          }
          return remaining;
        });
        setNotice('This connection had already ended.');
      } else {
        setActionError(err?.message || 'Unable to complete unmatch right now. Please retry safely.');
      }
    } finally {
      setIsUnmatching(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget || isBlocking) return;
    const target = blockTarget;
    setIsBlocking(true);
    setActionError(null);
    setNotice(null);

    try {
      await api.blockCandidate(
        target.candidate.profileId,
        blockReason.trim() || 'Safety block applied from Matches',
      );
      setBlockTarget(null);
      setBlockReason('');
      setMobileDetailMatch((cur) => (cur?.id === target.id ? null : cur));

      setMatches((prev) => {
        const remaining = removeMatchById(prev, target.id);
        setSelectedMatchId(selectActiveMatch(remaining, null)?.id ?? null);
        if (remaining.length === 0) {
          setEmptyKind('just_ended');
        }
        return remaining;
      });

      setNotice(
        `${target.candidate.displayName} has been permanently blocked. Mutual visibility, match access, and messaging are disabled.`,
      );
    } catch (err: any) {
      setBlockTarget(null);
      setActionError(err?.message || 'Could not apply safety block right now. Please retry.');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || isReporting) return;
    const target = reportTarget;
    const key = getOrCreateActionKey('report', target.id);

    setIsReporting(true);
    setReportError(null);

    try {
      const reportRes = await api.reportCandidate(
        target.candidate.profileId,
        reportCategory,
        reportDescription.trim() || undefined,
        key,
      );

      let alsoBlocked = false;
      if (reportAlsoBlock) {
        try {
          await api.blockCandidate(
            target.candidate.profileId,
            `Reported (${reportCategory}) from Matches`,
          );
          alsoBlocked = true;
          setMobileDetailMatch((cur) => (cur?.id === target.id ? null : cur));
          setMatches((prev) => {
            const remaining = removeMatchById(prev, target.id);
            setSelectedMatchId(selectActiveMatch(remaining, null)?.id ?? null);
            if (remaining.length === 0) {
              setEmptyKind('just_ended');
            }
            return remaining;
          });
        } catch {
          alsoBlocked = false;
        }
      }

      clearActionKey('report', target.id);
      setReportTarget(null);
      setReportDescription('');
      setReportAlsoBlock(false);
      setNotice(
        alsoBlocked
          ? `Report submitted to Trust & Safety and ${target.candidate.displayName} blocked immediately.`
          : reportRes.alreadyReported
            ? 'Your safety report was already recorded and remains queued for Trust & Safety review.'
            : 'Safety report submitted confidentially for Trust & Safety review. Your active connection state was left unchanged.',
      );
    } catch (err: any) {
      setReportError(err?.message || 'Unable to submit safety report right now. Please retry.');
    } finally {
      setIsReporting(false);
    }
  };

  const renderWorkbenchProfile = (
    match: MatchProfile,
    photoIndex: number,
    setPhotoIndex: (idx: number) => void,
    inModal = false,
  ) => {
    const c = match.candidate;
    const photos = c.photos || [];
    const activePhoto = photos[photoIndex] || photos[0] || null;
    const photoBroken = activePhoto ? Boolean(brokenPhotoIds[activePhoto.id]) : true;
    const coarseLocation = formatCoarseLocation(c.locationCity, c.locationState);
    const intentionLabel = formatIntentionLabel(c.intention);

    return (
      <div className="flex flex-col gap-5">
        {/* Photo Stage */}
        <div className="rounded-[10px] border border-edge bg-stage overflow-hidden">
          <div className={`relative ${inModal ? 'aspect-[4/3.8] max-h-[360px]' : 'aspect-[4/3.4] max-h-[390px]'} bg-stage overflow-hidden`}>
            {activePhoto?.photoUrl && !photoBroken ? (
              <img
                src={activePhoto.photoUrl}
                alt={`${c.displayName} portrait ${photoIndex + 1}`}
                onError={() =>
                  setBrokenPhotoIds((prev) => ({ ...prev, [activePhoto.id]: true }))
                }
                className="w-full h-full object-cover bg-stage"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-iron/70 text-ash gap-2">
                <div className="w-16 h-16 rounded-[8px] bg-coal border border-edge flex items-center justify-center text-xl font-semibold text-chalk">
                  {getInitials(c.displayName)}
                </div>
                <span className="text-xs">Portrait unavailable</span>
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="flex items-center gap-1.5 p-2 bg-coal border-t border-edge overflow-x-auto">
              {photos.map((ph, idx) => (
                <button
                  key={ph.id}
                  type="button"
                  onClick={() => setPhotoIndex(idx)}
                  className={`px-2.5 py-1 rounded-[4px] text-xs border transition-colors ${
                    idx === photoIndex
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

        {/* Identity & Metadata */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="verified" size="sm">
              Verified
            </Badge>
            <Badge variant="programme" size="sm">
              {formatProgrammeLabel(c.programmeFamily)}
            </Badge>
            {c.currentTerm && (
              <Badge variant="neutral" size="sm">
                {c.currentTerm}
              </Badge>
            )}
            {coarseLocation && (
              <Badge variant="neutral" size="sm">
                {coarseLocation}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-0.5">
            <h2
              data-testid={inModal ? 'modal-match-heading' : 'workbench-match-heading'}
              className="text-2xl font-semibold text-chalk tracking-tight"
            >
              {formatCandidateHeading(c.displayName, c.age)}
            </h2>
            <span className="text-xs text-ash">
              Matched {formatMatchDate(match.matchedAtIso)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-silver">
            {c.ageVisible === false && (
              <span className="text-ash">Age set to private</span>
            )}
            {intentionLabel && (
              <span>
                Looking for: <strong className="text-chalk font-medium">{intentionLabel}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Primary & Deliberate Connection Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-y border-edge">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={buildChatHrefForMatch(match)}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<ChatIcon size={16} />}
                data-testid={inModal ? 'modal-open-conversation-btn' : 'workbench-open-conversation-btn'}
              >
                Open Conversation
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setUnmatchReason('');
                setUnmatchTarget(match);
              }}
              leftIcon={<XIcon size={15} />}
              data-testid={inModal ? 'modal-unmatch-btn' : 'workbench-unmatch-btn'}
              className="!bg-iron !border-edge hover:!border-warning/60 hover:!text-warning"
            >
              Unmatch
            </Button>
          </div>

          {/* Separated Safety Actions */}
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setReportError(null);
                setReportCategory('harassment');
                setReportDescription('');
                setReportAlsoBlock(false);
                setReportTarget(match);
              }}
              data-testid={inModal ? 'modal-report-btn' : 'workbench-report-btn'}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-[6px] text-ash hover:text-warning hover:bg-iron transition-colors focus-visible:outline-2 focus-visible:outline-iris"
            >
              <FlagIcon size={14} />
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBlockReason('');
                setBlockTarget(match);
              }}
              data-testid={inModal ? 'modal-block-btn' : 'workbench-block-btn'}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-[6px] text-ash hover:text-danger hover:bg-iron transition-colors focus-visible:outline-2 focus-visible:outline-iris"
            >
              <ShieldIcon size={14} />
              <span>Block</span>
            </button>
          </div>
        </div>

        {/* Biography */}
        <div>
          <h3 className="text-[13px] font-medium text-silver/85 mb-1.5">
            About
          </h3>
          <p className="text-[15px] text-chalk leading-relaxed whitespace-pre-line">
            {c.bio?.trim() || 'No written biography shared yet.'}
          </p>
        </div>

        {/* Prompts */}
        {c.promptAnswers && c.promptAnswers.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-medium text-silver/85">
              Conversation prompts
            </h3>
            {c.promptAnswers.map((pa, idx) => (
              <div
                key={pa.id || `${c.profileId}-prompt-${idx}`}
                className="p-4 rounded-[8px] bg-iron border border-edge flex flex-col gap-1"
              >
                <p className="text-[13px] font-medium text-iris">{pa.promptText}</p>
                <p className="text-[15px] text-chalk leading-relaxed">&ldquo;{pa.answerText}&rdquo;</p>
              </div>
            ))}
          </div>
        )}

        {/* Interests */}
        {c.interests && c.interests.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h3 className="text-[13px] font-medium text-silver/85">
                Interests
              </h3>
              {c.sharedInterests && c.sharedInterests.length > 0 && (
                <span className="text-xs text-iris font-medium">
                  {c.sharedInterests.length} shared with you
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {c.interests.map((tag) => {
                const isShared = c.sharedInterests?.includes(tag);
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-[13px] border ${
                      isShared
                        ? 'bg-[#1C1C2E] border-iris/60 text-chalk font-medium'
                        : 'bg-iron border-edge text-silver'
                    }`}
                  >
                    {isShared && (
                      <span className="w-1.5 h-1.5 bg-iris shrink-0" aria-hidden="true" />
                    )}
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-[calc(100vh-68px)] bg-stage text-chalk font-ui">
      <div className="container-app pt-5 sm:pt-7 pb-24 md:pb-12 flex flex-col gap-6">
        <PageHeader
          accent="ember"
          contextLabel={`Bilateral connections · ${matches.length} active`}
          title="Mutual Matches"
          description="Verified IIT Madras BS peers where both of you expressed interest independently. Unmatching ends the connection cleanly."
          actions={
            <>
              <Link href="/likes">
                <Button variant="secondary" size="sm" leftIcon={<HeartIcon size={15} />}>
                  Likes
                </Button>
              </Link>
              <Link href="/discover">
                <Button variant="primary" size="sm" leftIcon={<CompassIcon size={15} />}>
                  Explore Discover
                </Button>
              </Link>
            </>
          }
        />

        {/* Hidden compatibility testId preserved */}
        <span data-testid="matches-active-count" className="sr-only">
          {matches.length} Active
        </span>

        {/* Feedback Banners */}
        {notice && (
          <div
            role="status"
            data-testid="matches-status-notice"
            className="px-4 py-3 rounded-[8px] bg-coal border border-edge text-sm text-silver flex items-center justify-between gap-3"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-medium text-silver hover:text-chalk px-2.5 py-1.5 rounded-[4px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            data-testid="matches-action-error"
            className="px-4 py-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-sm text-danger flex items-center justify-between gap-3"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-xs font-medium text-danger hover:underline px-2.5 py-1.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content Switch */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-[12px] border border-edge bg-coal divide-y divide-edge">
              {[1, 2, 3].map((slot) => (
                <div key={slot} className="p-4 flex items-center gap-4">
                  <Skeleton width="72px" height="84px" rounded="control" className="shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton width="55%" height="18px" />
                    <Skeleton width="75%" height="14px" />
                    <Skeleton width="65%" height="14px" />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden lg:block lg:col-span-7 rounded-[12px] border border-edge bg-coal p-6">
              <Skeleton width="100%" height="280px" rounded="control" className="mb-5" />
              <Skeleton width="45%" height="24px" className="mb-3" />
              <Skeleton width="85%" height="16px" className="mb-2" />
              <Skeleton width="70%" height="16px" />
            </div>
          </div>
        ) : loadError ? (
          <IntervalEmptyComposition
            testId="matches-error-state"
            variant="matches"
            eyebrow="Service interrupted"
            title="Unable to load your mutual matches"
            description={loadError}
            primaryAction={{ label: 'Retry', onClick: loadMatches, variant: 'primary' }}
            secondaryAction={{
              label: 'Explore Discover',
              onClick: () => router.push('/discover'),
              variant: 'secondary',
            }}
          />
        ) : matches.length === 0 ? (
          emptyKind === 'just_ended' ? (
            <IntervalEmptyComposition
              testId="matches-ended-empty-state"
              variant="matches"
              eyebrow="Connection closed"
              title="That connection has ended"
              description="Unmatching ends private messaging cleanly without applying a block unless you choose Block separately."
              primaryAction={{
                label: 'Explore Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Review Likes',
                onClick: () => router.push('/likes'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Private channel', value: 'Closed cleanly for both people' },
                { label: 'Separation rule', value: 'Unmatch does not create a safety block' },
              ]}
            />
          ) : emptyKind === 'unavailable' ? (
            <IntervalEmptyComposition
              testId="matches-unavailable-empty-state"
              variant="matches"
              eyebrow="Connection unavailable"
              title="This connection is no longer active"
              description="No active mutual matches remain. When both verified learners express interest independently again, active conversations will appear here."
              primaryAction={{
                label: 'Refresh Matches',
                onClick: loadMatches,
                variant: 'secondary',
              }}
              secondaryAction={{
                label: 'Explore Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
            />
          ) : (
            <IntervalEmptyComposition
              testId="matches-empty-state"
              variant="matches"
              eyebrow="Two-way recognition"
              title="No active mutual matches yet"
              description="SayMyName unlocks private messaging only when two verified learners like each other independently. Incoming likes await your review in Likes without paywalls."
              primaryAction={{
                label: 'Explore Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Review Received Likes',
                onClick: () => router.push('/likes'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Messaging rule', value: 'Requires active bilateral match' },
                { label: 'Discovery choices', value: 'Unilateral likes & passes stay private' },
              ]}
            />
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Structured Match Roster (5 Cols Desktop) */}
            <section aria-label="Active matches list" className="lg:col-span-5 flex flex-col gap-3">
              {matches.length >= 4 && (
                <div>
                  <label htmlFor="matches-filter-input" className="sr-only">
                    Filter active matches
                  </label>
                  <input
                    id="matches-filter-input"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by name, programme, or city..."
                    className="w-full h-11 px-4 rounded-[8px] bg-coal border border-edge text-sm text-chalk placeholder:text-silver/60 focus-visible:outline-2 focus-visible:outline-iris"
                  />
                </div>
              )}

              {filteredMatches.length === 0 ? (
                <div className="p-6 rounded-[12px] border border-edge bg-coal text-center flex flex-col items-center gap-3">
                  <p className="text-sm font-medium text-chalk">
                    No matches filter to &ldquo;{searchQuery}&rdquo;
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Filter
                  </Button>
                </div>
              ) : (
                <div className="rounded-[12px] border border-edge bg-coal overflow-hidden">
                  {filteredMatches.map((m) => {
                    const isSelected = selectedMatch?.id === m.id;
                    const primaryPhoto =
                      m.candidate.photos?.find((p) => p.isPrimary) || m.candidate.photos?.[0] || null;
                    const photoBroken = primaryPhoto ? Boolean(brokenPhotoIds[primaryPhoto.id]) : true;
                    const location = formatCoarseLocation(
                      m.candidate.locationCity,
                      m.candidate.locationState,
                    );

                    return (
                      <StructuredListRow
                        key={m.id}
                        selected={isSelected}
                        testId={`match-card-${m.id}`}
                        media={
                          <button
                            type="button"
                            onClick={() => verifyAndSelectMatch(m, false)}
                            aria-label={`Select ${m.candidate.displayName}`}
                            className="w-16 h-20 rounded-[8px] border border-edge bg-stage overflow-hidden block focus-visible:outline-2 focus-visible:outline-iris"
                          >
                            {primaryPhoto?.photoUrl && !photoBroken ? (
                              <img
                                src={primaryPhoto.photoUrl}
                                alt={`${m.candidate.displayName} portrait`}
                                onError={() =>
                                  setBrokenPhotoIds((prev) => ({
                                    ...prev,
                                    [primaryPhoto.id]: true,
                                  }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center bg-iron text-base font-semibold text-chalk">
                                {getInitials(m.candidate.displayName)}
                              </span>
                            )}
                          </button>
                        }
                        actions={
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => verifyAndSelectMatch(m, true)}
                              leftIcon={<UserIcon size={14} />}
                              data-testid={`match-details-btn-${m.id}`}
                              className="lg:hidden border border-edge bg-coal text-silver"
                            >
                              Profile
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUnmatchReason('');
                                setUnmatchTarget(m);
                              }}
                              data-testid={`match-unmatch-btn-${m.id}`}
                              className="lg:hidden text-silver hover:text-warning"
                            >
                              Unmatch
                            </Button>

                            <Link href={buildChatHrefForMatch(m)}>
                              <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<ChatIcon size={14} />}
                                data-testid={`match-open-chat-btn-${m.id}`}
                              >
                                Chat
                              </Button>
                            </Link>
                          </div>
                        }
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => verifyAndSelectMatch(m, false)}
                              className="text-left text-base font-semibold text-chalk truncate hover:text-iris transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                            >
                              {formatCandidateHeading(m.candidate.displayName, m.candidate.age)}
                            </button>
                            <span className="text-xs text-silver/75 shrink-0 tabular-nums">
                              {formatMatchDate(m.lastMessageAt || m.matchedAtIso)}
                            </span>
                          </div>

                          <p className="text-[13px] text-silver/90 truncate">
                            {formatProgrammeLabel(m.candidate.programmeFamily)}
                            {location ? ` · ${location}` : ''}
                          </p>

                          <p className="text-[13px] text-silver/80 line-clamp-1 mt-0.5">
                            {m.lastMessage
                              ? `${m.lastMessageIsOwn ? 'You: ' : ''}${m.lastMessage}`
                              : 'Private 1-on-1 chat unlocked'}
                          </p>
                        </div>
                      </StructuredListRow>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Right Active Match Detail Workbench (7 Cols Desktop) */}
            <aside
              aria-label="Selected match details"
              data-testid="match-workbench-panel"
              className="hidden lg:flex lg:col-span-7 flex-col rounded-[12px] border border-edge bg-coal p-6 xl:p-7 lg:sticky lg:top-[84px]"
            >
              {selectedMatch ? (
                <>
                  {refreshingMatchId === selectedMatch.id && (
                    <p className="text-xs text-silver/75 mb-3">
                      Verifying active connection state...
                    </p>
                  )}
                  {renderWorkbenchProfile(
                    selectedMatch,
                    workbenchPhotoIndex,
                    setWorkbenchPhotoIndex,
                    false,
                  )}
                </>
              ) : (
                <div className="py-12 text-center text-sm text-silver">
                  Select a match on the left to inspect profile details or manage your connection.
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {/* Responsive Profile & Connection Inspection Modal */}
      {mobileDetailMatch && (
        <Dialog
          isOpen={Boolean(mobileDetailMatch)}
          onClose={() => setMobileDetailMatch(null)}
          title={formatCandidateHeading(
            mobileDetailMatch.candidate.displayName,
            mobileDetailMatch.candidate.age,
          )}
          description={formatProgrammeLabel(mobileDetailMatch.candidate.programmeFamily)}
          maxWidth="lg"
        >
          <div
            data-testid="match-profile-modal"
            className="max-h-[70vh] overflow-y-auto pr-1"
          >
            {renderWorkbenchProfile(
              mobileDetailMatch,
              mobilePhotoIndex,
              setMobilePhotoIndex,
              true,
            )}
          </div>
        </Dialog>
      )}

      {/* Unmatch Confirmation Dialog (Separate from Block & Report) */}
      {unmatchTarget && (
        <Dialog
          isOpen={Boolean(unmatchTarget)}
          onClose={() => {
            if (!isUnmatching) setUnmatchTarget(null);
          }}
          title={getUnmatchDialogContent(unmatchTarget.candidate.displayName).title}
          description={
            getUnmatchDialogContent(unmatchTarget.candidate.displayName).description
          }
          maxWidth="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setUnmatchTarget(null)}
                disabled={isUnmatching}
                data-testid="cancel-unmatch-btn"
                className="!bg-coal !border !border-edge"
              >
                Keep Match
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmUnmatch}
                isLoading={isUnmatching}
                disabled={isUnmatching}
                data-testid="confirm-unmatch-btn"
              >
                Unmatch
              </Button>
            </>
          }
        >
          <div data-testid="unmatch-confirm-dialog" className="flex flex-col gap-3">
            <p className="text-sm text-silver leading-relaxed">
              {getUnmatchDialogContent(unmatchTarget.candidate.displayName).explanation}
            </p>
            <textarea
              value={unmatchReason}
              onChange={(e) => setUnmatchReason(e.target.value)}
              placeholder="Optional personal note (not shown publicly)..."
              rows={2}
              maxLength={200}
              className="w-full p-2.5 rounded-[8px] bg-coal border border-edge text-sm text-chalk placeholder:text-ash focus-visible:outline-2 focus-visible:outline-iris"
            />
          </div>
        </Dialog>
      )}

      {/* Safety Block Confirmation Dialog */}
      {blockTarget && (
        <Dialog
          isOpen={Boolean(blockTarget)}
          onClose={() => {
            if (!isBlocking) setBlockTarget(null);
          }}
          title={`Block ${blockTarget.candidate.displayName}?`}
          description="Safety block prevents all future contact and mutual visibility."
          maxWidth="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBlockTarget(null)}
                disabled={isBlocking}
                className="!bg-coal !border !border-edge"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmBlock}
                isLoading={isBlocking}
                disabled={isBlocking}
                data-testid="confirm-block-btn"
              >
                Block Permanently
              </Button>
            </>
          }
        >
          <div data-testid="block-confirm-dialog" className="flex flex-col gap-3">
            <p className="text-sm text-silver leading-relaxed">
              Blocking ends this connection immediately, closes your private conversation, and permanently prevents mutual discovery or future messaging in either direction.
            </p>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Optional safety reason..."
              rows={2}
              maxLength={300}
              className="w-full p-2.5 rounded-[8px] bg-coal border border-edge text-sm text-chalk placeholder:text-ash focus-visible:outline-2 focus-visible:outline-iris"
            />
          </div>
        </Dialog>
      )}

      {/* Safety Report Dialog */}
      {reportTarget && (
        <Dialog
          isOpen={Boolean(reportTarget)}
          onClose={() => {
            if (!isReporting) setReportTarget(null);
          }}
          title={`Report ${reportTarget.candidate.displayName}`}
          description="Submitted confidentially to Trust & Safety. Internal moderation notes are never exposed publicly."
          maxWidth="md"
        >
          <form
            onSubmit={handleSubmitReport}
            data-testid="report-modal-dialog"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-ash">
                Report category
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
                      name="matchesReportCategory"
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
              placeholder="Share what happened (optional)..."
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
              <span>Also block {reportTarget.candidate.displayName} immediately</span>
            </label>

            {reportError && <p className="text-xs text-danger">{reportError}</p>}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-edge">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setReportTarget(null)}
                disabled={isReporting}
                className="!bg-coal !border !border-edge"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                isLoading={isReporting}
                disabled={isReporting}
                data-testid="confirm-report-btn"
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
