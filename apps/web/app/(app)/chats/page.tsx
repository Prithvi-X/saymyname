'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, MatchProfile, ChatMessage } from '../../../lib/api';
import {
  formatCandidateHeading,
  formatProgrammeLabel,
  getInitials,
} from '../../../lib/discover-state';
import { formatMatchDate } from '../../../lib/matches-state';
import {
  Badge,
  Button,
  Dialog,
  IntervalEmptyComposition,
  Skeleton,
} from '../../../components/ui';
import {
  FlagIcon,
  ShieldIcon,
  SendIcon,
  LockIcon,
} from '../../../components/icons';

function ChatsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectMatchId = searchParams.get('matchId');
  const preselectConversationId = searchParams.get('conversationId');

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchProfile | null>(null);
  const [connectionEndedNotice, setConnectionEndedNotice] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [safetyFeedback, setSafetyFeedback] = useState<string | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [activeModal, setActiveModal] = useState<'report' | 'block' | null>(null);

  // Safety state
  const [reportReason, setReportReason] = useState('Inappropriate content or messages');
  const [reportNotes, setReportNotes] = useState('');
  const [isSubmittingSafety, setIsSubmittingSafety] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.getMatches();
      setMatches(list);
      if (preselectMatchId || preselectConversationId) {
        const matched = list.find(
          (m) =>
            (preselectMatchId && m.id === preselectMatchId) ||
            (preselectConversationId && m.conversationId === preselectConversationId),
        );
        if (matched) {
          setConnectionEndedNotice(false);
          setActiveMatch(matched);
          setMobileShowThread(true);
        } else {
          setConnectionEndedNotice(true);
          setActiveMatch(null);
          setMessages([]);
          setMobileShowThread(true);
        }
      } else if (list.length > 0) {
        setConnectionEndedNotice(false);
        setActiveMatch(list[0]);
        setMobileShowThread(true);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load conversations right now.');
    } finally {
      setLoading(false);
    }
  }, [preselectMatchId, preselectConversationId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const loadMessagesForMatch = useCallback(async (match: MatchProfile) => {
    const targetConvId = match.conversationId || match.id;
    setLoadingMessages(true);
    setMessageError(null);
    try {
      const history = await api.getMessages(targetConvId);
      setMessages(history);
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        setConnectionEndedNotice(true);
        setMessages([]);
        setMatches((prev) => prev.filter((m) => m.id !== match.id));
        setActiveMatch(null);
      } else {
        setMessageError(err?.message || 'Unable to load conversation messages right now.');
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!activeMatch) return;
    loadMessagesForMatch(activeMatch);
  }, [activeMatch, loadMessagesForMatch]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const selectConversation = (match: MatchProfile) => {
    setConnectionEndedNotice(false);
    setMessageError(null);
    setActiveMatch(match);
    setMobileShowThread(true);
  };

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return isNaN(d.getTime())
      ? timeStr
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeMatch || !text.trim() || sending || connectionEndedNotice) return;

    const trimmed = text.trim();
    if (trimmed.length > 1000) {
      setMessageError('Message exceeds the 1,000 character limit.');
      return;
    }

    const targetConvId = activeMatch.conversationId || activeMatch.id;
    setSending(true);
    setMessageError(null);
    try {
      const sent = await api.sendMessage(targetConvId, trimmed);
      setMessages((prev) => [...prev, sent]);
      setText('');
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        setConnectionEndedNotice(true);
        setMessages([]);
        setMatches((prev) => prev.filter((m) => m.id !== activeMatch.id));
        setActiveMatch(null);
      } else {
        setMessageError(err?.message || 'Failed to send message. Your draft has been kept.');
      }
    } finally {
      setSending(false);
    }
  };

  const confirmBlock = async () => {
    if (!activeMatch || isSubmittingSafety) return;
    setIsSubmittingSafety(true);
    try {
      await api.blockCandidate(activeMatch.candidate.profileId, 'User blocked from Chats');
      setActiveModal(null);
      setSafetyFeedback(
        `Blocked ${activeMatch.candidate.displayName}. Mutual visibility has been closed immediately.`,
      );
      const remaining = matches.filter((m) => m.id !== activeMatch.id);
      setMatches(remaining);
      setActiveMatch(remaining[0] || null);
      if (remaining.length === 0) {
        setMobileShowThread(false);
      }
    } catch (err: any) {
      setMessageError(err?.message || 'Unable to complete block right now.');
      setActiveModal(null);
    } finally {
      setIsSubmittingSafety(false);
    }
  };

  const submitReport = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!activeMatch || isSubmittingSafety) return;
    setIsSubmittingSafety(true);
    try {
      const category = reportReason.toLowerCase().includes('harass')
        ? 'harassment'
        : reportReason.toLowerCase().includes('spam')
          ? 'spam'
          : reportReason.toLowerCase().includes('impersonation')
            ? 'fake_profile'
            : 'inappropriate_content';
      const description = reportNotes ? `${reportReason}: ${reportNotes}` : reportReason;
      await api.reportCandidate(activeMatch.candidate.profileId, category, description);
      setActiveModal(null);
      setReportNotes('');
      setSafetyFeedback('Report submitted confidentially for safety moderation review.');
      setTimeout(() => setSafetyFeedback(null), 3500);
    } catch (err: any) {
      setMessageError(err?.message || 'Unable to submit report right now.');
    } finally {
      setIsSubmittingSafety(false);
    }
  };

  const conversationStarters = activeMatch
    ? [
        `Hey ${activeMatch.candidate.displayName}, glad we matched! How is your term going in ${formatProgrammeLabel(activeMatch.candidate.programmeFamily)}?`,
        ...(activeMatch.candidate.interests?.slice(0, 1).map(
          (interest) =>
            `I noticed we share an interest in ${interest} — what got you into it?`,
        ) || []),
        'What has been the highlight of your week outside coursework?',
      ]
    : [];

  if (loading) {
    return (
      <div className="container-app pt-6 pb-24 md:py-7 font-ui">
        <div className="rounded-[12px] border border-edge bg-coal overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-edge p-5 flex flex-col gap-3">
            <Skeleton width="45%" height="22px" />
            <Skeleton width="100%" height="68px" rounded="control" />
            <Skeleton width="100%" height="68px" rounded="control" />
          </div>
          <div className="md:col-span-8 p-6 flex flex-col justify-between gap-4">
            <Skeleton width="42%" height="32px" />
            <Skeleton width="100%" height="280px" rounded="control" />
            <Skeleton width="100%" height="48px" rounded="control" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app pt-5 pb-24 sm:pt-7 md:pb-8 font-ui flex flex-col gap-4">
      {safetyFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-[8px] bg-coal border border-iris/50 text-sm text-chalk flex items-center justify-between gap-3"
        >
          <span>{safetyFeedback}</span>
          <button
            type="button"
            onClick={() => setSafetyFeedback(null)}
            className="text-xs font-medium text-silver hover:text-chalk px-2.5 py-1.5 rounded-[4px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadError ? (
        <IntervalEmptyComposition
          variant="chats"
          eyebrow="Connection interrupted"
          title="Unable to load conversations"
          description={loadError}
          primaryAction={{
            label: 'Retry loading',
            onClick: loadMatches,
            variant: 'primary',
          }}
        />
      ) : matches.length === 0 ? (
        <div className="pt-2">
          {connectionEndedNotice ? (
            <IntervalEmptyComposition
              testId="ended-conversation-notice"
              variant="chats"
              eyebrow="Connection closed"
              title="This connection has ended"
              description="The mutual match linked to this conversation is no longer active. Messaging is closed cleanly for both people."
              primaryAction={{
                label: 'Return to Matches',
                onClick: () => router.push('/matches'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Explore Discover',
                onClick: () => router.push('/discover'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Channel status', value: 'Closed cleanly after unmatch or block' },
                { label: 'Messaging rule', value: 'Only active mutual matches may message' },
              ]}
            />
          ) : (
            <IntervalEmptyComposition
              variant="chats"
              eyebrow="Private match channels"
              title="No active conversations yet"
              description="SayMyName blocks unsolicited stranger DMs. One-to-one messaging unlocks only after two verified members like each other independently."
              primaryAction={{
                label: 'Explore Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Check Matches & Likes',
                onClick: () => router.push('/matches'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Messaging rule', value: 'Mutual match required first' },
                { label: 'Default privacy', value: 'No advertising or automated training use' },
              ]}
            />
          )}
        </div>
      ) : (
        <div className="rounded-[12px] border border-edge bg-coal overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-160px)] md:h-[calc(100dvh-120px)] min-h-[480px] md:min-h-[580px]">
          {/* Left Sidebar (4 Cols on md, 3 Cols on xl): Conversation Channels */}
          <aside
            aria-label="Conversation channels"
            className={`${
              mobileShowThread ? 'hidden md:flex' : 'flex'
            } md:col-span-4 xl:col-span-3 border-b md:border-b-0 md:border-r border-edge bg-coal flex-col min-h-0`}
          >
            <div className="px-5 py-4 border-b border-edge flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-chalk tracking-tight">
                  Chats
                </h1>
                <p className="text-xs text-silver/80 mt-0.5">
                  Mutual match channels
                </p>
              </div>
              <Badge variant="neutral" size="sm">
                {matches.length} active
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-edge">
              {matches.map((m) => {
                const isSelected = activeMatch?.id === m.id;
                const photo = m.candidate.photos?.[0]?.photoUrl;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectConversation(m)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`w-full text-left px-4 py-3.5 min-h-[68px] flex items-center gap-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-iris focus-visible:outline-offset-[-2px] ${
                      isSelected
                        ? 'bg-slate'
                        : 'bg-coal hover:bg-iron'
                    }`}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={m.candidate.displayName}
                        className="w-11 h-11 rounded-[8px] object-cover shrink-0 border border-edge"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-[8px] bg-iron border border-edge text-chalk flex items-center justify-center font-semibold text-sm shrink-0">
                        {getInitials(m.candidate.displayName)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-chalk truncate flex items-center gap-2">
                          <span>{m.candidate.displayName}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-[1px] bg-iris shrink-0" aria-hidden="true" />
                          )}
                        </span>
                        <span className="text-xs text-silver/75 shrink-0 tabular-nums">
                          {formatMatchDate(m.matchedAtIso || m.matchedAt)}
                        </span>
                      </div>
                      <p className="text-[13px] text-silver truncate mt-0.5">
                        {m.lastMessage || 'Mutual match active'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Pane (8 Cols on md, 9 Cols on xl): Active Message Thread */}
          {activeMatch ? (
            <section
              aria-label={`Conversation with ${activeMatch.candidate.displayName}`}
              className={`${
                mobileShowThread ? 'flex' : 'hidden md:flex'
              } md:col-span-8 xl:col-span-9 flex-col min-w-0 min-h-0 bg-coal`}
            >
              {/* Thread Header */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-edge bg-coal flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-[6px] border border-edge bg-iron text-[13px] font-medium text-chalk shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                    aria-label="Back to conversations list"
                  >
                    &larr; Chats ({matches.length})
                  </button>

                  {activeMatch.candidate.photos?.[0]?.photoUrl ? (
                    <img
                      src={activeMatch.candidate.photos[0].photoUrl}
                      alt={activeMatch.candidate.displayName}
                      className="w-11 h-11 rounded-[8px] object-cover border border-edge shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-[8px] bg-iron border border-edge text-chalk flex items-center justify-center font-semibold text-sm shrink-0">
                      {getInitials(activeMatch.candidate.displayName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-semibold text-chalk truncate">
                        {formatCandidateHeading(
                          activeMatch.candidate.displayName,
                          activeMatch.candidate.age,
                        )}
                      </h2>
                      <Badge variant="verified" size="sm">
                        Verified
                      </Badge>
                    </div>
                    <p className="text-[13px] text-silver/85 truncate">
                      {formatProgrammeLabel(activeMatch.candidate.programmeFamily)}
                    </p>
                  </div>
                </div>

                {/* Real Safety & Match Management Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href="/matches"
                    className="hidden sm:inline-flex items-center px-3 min-h-[44px] rounded-[8px] border border-edge bg-iron text-[13px] font-medium text-silver hover:text-chalk hover:bg-slate transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                  >
                    Match profile
                  </Link>

                  <button
                    type="button"
                    onClick={() => setActiveModal('report')}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-[8px] border border-edge bg-iron text-silver hover:text-warning hover:border-warning/50 transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                    aria-label="Report conversation"
                    title="Report conversation"
                  >
                    <FlagIcon size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModal('block')}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-[8px] border border-edge bg-iron text-silver hover:text-danger hover:border-danger/50 transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                    aria-label="Block user"
                    title="Block user"
                  >
                    <ShieldIcon size={16} />
                  </button>
                </div>
              </div>

              {/* Honest Privacy Context Bar */}
              <div className="px-4 sm:px-6 py-2.5 bg-iron/70 border-b border-edge text-[13px] text-silver flex items-center gap-2">
                <LockIcon size={14} color="#8580C4" className="shrink-0" />
                <span>
                  Mutual match active · Private messaging stays strictly between you and your match.
                </span>
              </div>

              {/* Message Timeline */}
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 bg-void flex flex-col gap-4"
              >
                {loadingMessages ? (
                  <div className="flex flex-col gap-3 py-4">
                    <Skeleton width="55%" height="56px" rounded="control" />
                    <Skeleton width="48%" height="56px" rounded="control" className="self-end" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="my-auto max-w-xl mx-auto w-full rounded-[12px] border border-edge bg-coal p-6 flex flex-col gap-4">
                    <div className="pb-3 border-b border-edge flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[13px] font-medium text-iris">
                          Mutual match active
                        </span>
                        <h3 className="text-lg font-semibold text-chalk mt-0.5">
                          Start the conversation with {activeMatch.candidate.displayName}
                        </h3>
                        <p className="text-[13px] text-silver mt-0.5">
                          {formatProgrammeLabel(activeMatch.candidate.programmeFamily)}
                          {activeMatch.candidate.currentTerm
                            ? ` · ${activeMatch.candidate.currentTerm}`
                            : ''}
                        </p>
                      </div>
                      <Badge variant="verified" size="sm">
                        Verified
                      </Badge>
                    </div>

                    {activeMatch.candidate.bio?.trim() && (
                      <p className="text-sm text-silver leading-relaxed bg-iron/60 border border-edge rounded-[8px] px-4 py-3">
                        {activeMatch.candidate.bio}
                      </p>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                      <span className="text-xs font-medium text-silver">
                        Suggested opening notes (tap to edit before sending)
                      </span>
                      <div className="flex flex-col gap-2">
                        {conversationStarters.map((starter, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setText(starter)}
                            className="text-left px-4 py-3 min-h-[44px] rounded-[8px] bg-iron border border-edge hover:border-iris text-[13px] text-chalk transition-colors focus-visible:outline-2 focus-visible:outline-iris"
                          >
                            &ldquo;{starter}&rdquo;
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col max-w-[85%] sm:max-w-[68%] ${
                        m.isOwn ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      <div
                        className={`px-4 py-3 text-[15px] leading-relaxed break-words ${
                          m.isOwn
                            ? 'smn-bubble-own rounded-[12px] rounded-br-[4px]'
                            : 'bg-iron border border-edge text-chalk rounded-[12px] rounded-bl-[4px]'
                        }`}
                      >
                        {m.text}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-silver/75 tabular-nums">
                        <span>{formatTime(m.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}

                {messageError && (
                  <div
                    role="alert"
                    className="px-4 py-3 rounded-[8px] bg-danger-subtle border border-danger/40 text-sm text-danger flex flex-wrap items-center justify-between gap-3"
                  >
                    <span>{messageError}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        text.trim() ? handleSend() : activeMatch && loadMessagesForMatch(activeMatch)
                      }
                    >
                      Retry
                    </Button>
                  </div>
                )}

              </div>

              {/* Persistent Accessible Message Composer */}
              <form
                onSubmit={handleSend}
                className="px-4 sm:px-5 py-3.5 border-t border-edge bg-coal flex items-center gap-3"
              >
                <div className="flex-1 min-w-0 relative">
                  <label htmlFor="chat-composer-input" className="sr-only">
                    Message {activeMatch.candidate.displayName}
                  </label>
                  <input
                    id="chat-composer-input"
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message ${activeMatch.candidate.displayName}...`}
                    maxLength={1000}
                    className="w-full h-12 pl-4 pr-16 rounded-[8px] bg-stage border border-edge text-sm text-chalk placeholder:text-silver/60 focus-visible:outline-2 focus-visible:outline-iris focus:border-iris transition-colors"
                  />
                  {text.length > 0 && (
                    <span
                      className={`hidden sm:inline absolute right-3.5 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                        text.length > 900 ? 'text-danger' : 'text-silver/70'
                      }`}
                    >
                      {text.length}/1000
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!text.trim() || sending}
                  isLoading={sending}
                  leftIcon={<SendIcon size={16} />}
                  aria-label="Send message"
                >
                  Send
                </Button>
              </form>
            </section>
          ) : connectionEndedNotice ? (
            <div
              data-testid="ended-conversation-notice"
              className="md:col-span-8 xl:col-span-9 flex flex-col items-center justify-center p-8 text-center gap-4"
            >
              <div className="max-w-md flex flex-col items-center gap-3">
                <Badge variant="neutral" size="sm">
                  Connection Closed
                </Badge>
                <h2 className="text-lg font-semibold text-chalk">
                  This connection is no longer active
                </h2>
                <p className="text-sm text-silver leading-relaxed">
                  Private messaging for this match has closed. Other active connections remain accessible in your list.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <Button variant="secondary" size="md" onClick={() => router.push('/matches')}>
                    Back to Matches
                  </Button>
                  {matches[0] && (
                    <Button variant="primary" size="md" onClick={() => selectConversation(matches[0])}>
                      Open Active Chat
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="md:col-span-8 xl:col-span-9 flex items-center justify-center p-8 text-sm text-silver">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      )}

      {/* REPORT MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'report' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title="Report Conversation"
        description="Confidential report reviewed by student safety operators."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              isLoading={isSubmittingSafety}
              onClick={submitReport}
            >
              Submit Report
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {[
            'Inappropriate content or messages',
            'Impersonation or false student identity',
            'Commercial solicitation or spam',
            'Boundary violation or harassment',
          ].map((reason) => (
            <label
              key={reason}
              className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-[8px] border cursor-pointer text-sm ${
                reportReason === reason
                  ? 'border-iris bg-slate text-chalk'
                  : 'border-edge bg-coal text-silver hover:bg-iron'
              }`}
            >
              <input
                type="radio"
                name="reportReason"
                checked={reportReason === reason}
                onChange={() => setReportReason(reason)}
                className="accent-iris"
              />
              <span>{reason}</span>
            </label>
          ))}

          <textarea
            rows={3}
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            placeholder="Additional context (optional)..."
            className="w-full p-3.5 rounded-[8px] bg-stage border border-edge text-sm text-chalk placeholder:text-silver/60 focus-visible:outline-2 focus-visible:outline-iris resize-none"
          />
        </div>
      </Dialog>

      {/* BLOCK MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'block' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title={activeMatch ? `Block ${activeMatch.candidate.displayName}?` : 'Block user?'}
        description="Blocking executes immediately on the server: messaging ends and mutual visibility is closed."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              isLoading={isSubmittingSafety}
              onClick={confirmBlock}
            >
              Confirm Block
            </Button>
          </>
        }
      >
        <p className="text-sm text-silver leading-relaxed">
          You can review or manage blocked accounts later from Profile Account &amp; Security controls.
        </p>
      </Dialog>
    </div>
  );
}

export default function ChatsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="container-app pt-10 text-sm text-silver">
          Loading conversations...
        </div>
      }
    >
      <ChatsContent />
    </React.Suspense>
  );
}
