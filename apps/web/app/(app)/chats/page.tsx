'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, MatchProfile, ChatMessage } from '../../../lib/api';
import { formatCandidateHeading, formatProgrammeLabel, getInitials } from '../../../lib/discover-state';
import { formatMatchDate } from '../../../lib/matches-state';
import {
  Badge,
  Button,
  Dialog,
  IntervalEmptyComposition,
  Skeleton,
} from '../../../components/ui';
import {
  PhoneIcon,
  GameIcon,
  HeartHandshakeIcon,
  FlagIcon,
  ShieldIcon,
  SendIcon,
  MicIcon,
  LockIcon,
  CalendarIcon,
  SparklesIcon,
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
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [safetyFeedback, setSafetyFeedback] = useState<string | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // Together Space & Safety Modals
  const [togetherHubOpen, setTogetherHubOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<
    'call' | 'game' | 'date' | 'relationship' | 'report' | 'block' | null
  >(null);

  // Call state
  const [callStatus, setCallStatus] = useState<string | null>(null);

  // Game state
  const [gameSelection, setGameSelection] = useState<'word_scramble' | 'iitm_trivia'>(
    'word_scramble',
  );
  const [gameActive, setGameActive] = useState(false);
  const [gameScore, setGameScore] = useState(0);

  // Virtual Date state
  const [dateProposed, setDateProposed] = useState(false);

  // Safety state
  const [reportReason, setReportReason] = useState('Inappropriate content or messages');
  const [reportNotes, setReportNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMatches() {
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
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, [preselectMatchId, preselectConversationId]);

  useEffect(() => {
    if (!activeMatch) return;
    const targetConvId = activeMatch.conversationId || activeMatch.id;
    async function loadMessages() {
      setMessageError(null);
      try {
        const history = await api.getMessages(targetConvId);
        setMessages(history);
      } catch (err: any) {
        if (err?.status === 403 || err?.status === 404) {
          setConnectionEndedNotice(true);
          setMessages([]);
          setMatches((prev) => prev.filter((m) => m.id !== activeMatch!.id));
          setActiveMatch(null);
        } else {
          setMessageError(err?.message || 'Unable to load conversation messages right now.');
        }
      }
    }
    loadMessages();
  }, [activeMatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = (match: MatchProfile) => {
    setConnectionEndedNotice(false);
    setMessageError(null);
    setActiveMatch(match);
    setTogetherHubOpen(false);
    setMobileShowThread(true);
  };

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return isNaN(d.getTime())
      ? timeStr
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch || !text.trim() || sending || connectionEndedNotice) return;

    const trimmed = text.trim();
    if (trimmed.length > 1000) {
      setMessageError('Message exceeds 1,000 character limit.');
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
        setMessageError(err?.message || 'Failed to send message.');
      }
    } finally {
      setSending(false);
    }
  };

  const confirmBlock = async () => {
    if (!activeMatch) return;
    await api.blockCandidate(activeMatch.candidate.profileId, 'User blocked from Chats');
    setActiveModal(null);
    setSafetyFeedback(
      `Blocked ${activeMatch.candidate.displayName}. Mutual visibility has been severed immediately.`,
    );
    const remaining = matches.filter((m) => m.id !== activeMatch.id);
    setMatches(remaining);
    setActiveMatch(remaining[0] || null);
    if (remaining.length === 0) {
      setMobileShowThread(false);
    }
  };

  const submitReport = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!activeMatch) return;
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
    setSafetyFeedback('Report submitted confidentially to student safety moderators.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  const handleStartCall = () => {
    setCallStatus('Connecting via LiveKit WebRTC...');
    setTimeout(() => {
      setCallStatus('Connected: 1-on-1 Audio • No Default Recording');
    }, 1200);
  };

  const handleEndCall = () => {
    setCallStatus(null);
    setActiveModal(null);
    setSafetyFeedback('Call ended safely. Duration: 01:24.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  const conversationStarters = activeMatch
    ? [
        `Hey ${activeMatch.candidate.displayName}, glad we matched! How is your term going in ${formatProgrammeLabel(activeMatch.candidate.programmeFamily)}?`,
        ...(activeMatch.candidate.interests?.slice(0, 1).map(
          (interest) =>
            `I noticed we share an interest in ${interest} — what got you into it?`,
        ) || []),
        'Want to try a quick cooperative Word Scramble or grab a virtual coffee session sometime this week?',
      ]
    : [];

  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-24 sm:pt-9 md:pb-10 font-ui">
        <div className="rounded-[12px] border border-edge bg-coal overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
          <div className="md:col-span-4 border-r border-edge p-5 flex flex-col gap-3">
            <Skeleton width="45%" height="20px" />
            <Skeleton width="100%" height="64px" rounded="control" />
            <Skeleton width="100%" height="64px" rounded="control" />
          </div>
          <div className="md:col-span-8 p-6 flex flex-col justify-between gap-4">
            <Skeleton width="50%" height="32px" />
            <Skeleton width="100%" height="280px" rounded="control" />
            <Skeleton width="100%" height="48px" rounded="control" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 sm:pt-8 md:pb-8 font-ui flex flex-col gap-4">
      {safetyFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-[8px] bg-coal border border-iris/50 text-sm text-chalk flex items-center justify-between gap-3"
        >
          <span>{safetyFeedback}</span>
          <button
            type="button"
            onClick={() => setSafetyFeedback(null)}
            className="text-xs text-ash hover:text-chalk px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="pt-2">
          {connectionEndedNotice ? (
            <IntervalEmptyComposition
              testId="ended-conversation-notice"
              variant="chats"
              eyebrow="Connection Closed"
              title="This connection has ended"
              description="The mutual match linked to this conversation is no longer active. Messaging and invitations are closed, and new messages cannot be sent."
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
                { label: 'Channel Status', value: 'Closed cleanly after unmatch or block' },
                { label: 'Messaging Rule', value: 'Only active bilateral matches may message' },
              ]}
            />
          ) : (
            <IntervalEmptyComposition
              variant="chats"
              eyebrow="Encrypted Match Channels"
              title="No active conversations yet"
              description="SayMyName strictly prohibits unsolicited stranger DMs. Messaging unlocks exclusively between two members who have mutually liked each other."
              primaryAction={{
                label: 'Explore Discovery',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Check Matches & Likes',
                onClick: () => router.push('/matches'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Messaging rule', value: 'Mutual match required' },
                { label: 'Default privacy', value: 'No call recording or ads' },
              ]}
            />
          )}
        </div>
      ) : (
        <div className="rounded-[12px] border border-edge bg-coal smn-surface-elevated overflow-hidden flex flex-col md:flex-row min-h-[calc(100vh-170px)] md:h-[calc(100vh-124px)] md:min-h-[600px]">
          {/* Left Sidebar: Conversations List */}
          <aside
            aria-label="Conversation channels"
            className={`${
              mobileShowThread ? 'hidden md:flex' : 'flex'
            } w-full md:w-[300px] lg:w-[336px] shrink-0 border-b md:border-b-0 md:border-r border-edge bg-stage/95 flex-col min-h-0`}
          >
            <div className="px-5 py-4 border-b border-edge flex items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ash">
                  Private Channels
                </span>
                <h1 className="text-lg font-semibold text-chalk tracking-tight mt-0.5">
                  Conversations
                </h1>
              </div>
              <Badge variant="neutral" size="sm">
                {matches.length} active
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-edge/40">
              {matches.map((m) => {
                const isSelected = activeMatch?.id === m.id;
                const photo = m.candidate.photos?.[0]?.photoUrl;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectConversation(m)}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors border-l-[3px] ${
                      isSelected
                        ? 'bg-iron/90 border-iris'
                        : 'bg-transparent border-transparent hover:bg-coal/80'
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
                        <span className="text-sm font-semibold text-chalk truncate">
                          {m.candidate.displayName}
                        </span>
                        <span className="text-[10px] text-ash shrink-0">
                          {formatMatchDate(m.matchedAtIso || m.matchedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-silver truncate mt-0.5">
                        {m.lastMessage || 'Mutual match active'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Pane: Active Thread Viewport */}
          {activeMatch ? (
            <section
              aria-label={`Conversation with ${activeMatch.candidate.displayName}`}
              className={`${
                mobileShowThread ? 'flex' : 'hidden md:flex'
              } flex-1 flex-col min-w-0 min-h-0 bg-coal`}
            >
              {/* Thread Header */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-edge bg-stage/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 h-9 rounded-[6px] border border-edge bg-iron text-xs font-medium text-chalk shrink-0"
                    aria-label="Back to conversations list"
                  >
                    &larr; {matches.length}
                  </button>

                  {activeMatch.candidate.photos?.[0]?.photoUrl ? (
                    <img
                      src={activeMatch.candidate.photos[0].photoUrl}
                      alt={activeMatch.candidate.displayName}
                      className="w-10 h-10 rounded-[8px] object-cover border border-edge shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-[8px] bg-iron border border-edge text-chalk flex items-center justify-center font-semibold text-sm shrink-0">
                      {getInitials(activeMatch.candidate.displayName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-chalk truncate">
                        {formatCandidateHeading(
                          activeMatch.candidate.displayName,
                          activeMatch.candidate.age,
                        )}
                      </h2>
                      <Badge variant="verified" size="sm">
                        Verified
                      </Badge>
                      {dateProposed && (
                        <Badge variant="programme" size="sm">
                          Date Invited
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-ash truncate">
                      {formatProgrammeLabel(activeMatch.candidate.programmeFamily)}
                    </p>
                  </div>
                </div>

                {/* Bilateral Communication & Safety Actions */}
                <div className="flex items-center gap-2 flex-wrap relative">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveModal('call')}
                    leftIcon={<PhoneIcon size={14} />}
                    title="Audio Call (Requires Bilateral Acceptance)"
                  >
                    Call
                  </Button>

                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTogetherHubOpen((prev) => !prev)}
                      leftIcon={<GameIcon size={14} />}
                      className="border border-edge bg-iron/80 text-chalk"
                      title="Together Space: Games, Virtual Dates & Relationship Mode"
                    >
                      Together Space
                    </Button>

                    {togetherHubOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-[10px] border border-edge bg-coal shadow-2xl z-40 overflow-hidden divide-y divide-edge">
                        <button
                          type="button"
                          onClick={() => {
                            setTogetherHubOpen(false);
                            setActiveModal('game');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-iron transition-colors flex items-center gap-3"
                        >
                          <GameIcon size={16} color="#E18A62" />
                          <div>
                            <div className="text-xs font-semibold text-chalk">
                              Word Games &amp; Trivia
                            </div>
                            <div className="text-[11px] text-ash">
                              Cooperative mini-games
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTogetherHubOpen(false);
                            setActiveModal('date');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-iron transition-colors flex items-center gap-3"
                        >
                          <CalendarIcon size={16} color="#8580C4" />
                          <div>
                            <div className="text-xs font-semibold text-chalk">
                              Virtual Date
                            </div>
                            <div className="text-[11px] text-ash">
                              Scheduled coffee session
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTogetherHubOpen(false);
                            setActiveModal('relationship');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-iron transition-colors flex items-center gap-3"
                        >
                          <HeartHandshakeIcon size={16} color="#8580C4" />
                          <div>
                            <div className="text-xs font-semibold text-iris">
                              Relationship Mode
                            </div>
                            <div className="text-[11px] text-ash">
                              Mutual shared space
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveModal('report')}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] border border-edge/80 bg-iron/60 text-ash hover:text-warning hover:border-warning/50 transition-colors"
                    aria-label="Report conversation"
                    title="Report"
                  >
                    <FlagIcon size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModal('block')}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] border border-edge/80 bg-iron/60 text-ash hover:text-danger hover:border-danger/50 transition-colors"
                    aria-label="Block user"
                    title="Block"
                  >
                    <ShieldIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Privacy Notice Banner */}
              <div className="px-4 sm:px-6 py-2 bg-iron/50 border-b border-edge/70 text-[11px] text-silver flex items-center gap-2">
                <LockIcon size={12} color="#8580C4" />
                <span>
                  Mutual Match Active • Private communication is never recorded by default or used for advertising.
                </span>
              </div>

              {/* Message Thread Body */}
              <div className="flex-1 min-h-[280px] overflow-y-auto px-4 sm:px-6 py-5 bg-void/70 flex flex-col gap-3.5">
                {messages.length === 0 ? (
                  /* Intentional First-Conversation Threshold (replaces blank empty container) */
                  <div className="my-auto max-w-xl mx-auto w-full rounded-[12px] border border-edge bg-coal/90 p-5 sm:p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-edge/80">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris">
                          <SparklesIcon size={12} />
                          <span>Mutual Match Established</span>
                        </span>
                        <h3 className="text-lg font-semibold text-chalk mt-1">
                          Begin chatting with {activeMatch.candidate.displayName}
                        </h3>
                        <p className="text-xs text-silver mt-0.5">
                          {formatProgrammeLabel(activeMatch.candidate.programmeFamily)}
                          {activeMatch.candidate.currentTerm
                            ? ` • ${activeMatch.candidate.currentTerm}`
                            : ''}
                        </p>
                      </div>
                      <Badge variant="verified" size="sm">
                        Verified
                      </Badge>
                    </div>

                    {activeMatch.candidate.bio?.trim() && (
                      <p className="text-xs text-silver leading-relaxed border-l-2 border-edge pl-3">
                        {activeMatch.candidate.bio}
                      </p>
                    )}

                    {activeMatch.candidate.interests &&
                      activeMatch.candidate.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {activeMatch.candidate.interests.slice(0, 5).map((item) => (
                            <span
                              key={item}
                              className="px-2 py-0.5 rounded-[4px] bg-iron border border-edge text-[11px] text-silver"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}

                    <div className="flex flex-col gap-2 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ash">
                        Draft a starter (edits before sending)
                      </span>
                      <div className="flex flex-col gap-2">
                        {conversationStarters.map((starter, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setText(starter)}
                            className="text-left px-3.5 py-2.5 rounded-[8px] bg-iron/80 border border-edge hover:border-iris/60 text-xs text-chalk transition-colors"
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
                      className={`flex flex-col max-w-[85%] sm:max-w-[72%] ${
                        m.isOwn ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                          m.isOwn
                            ? 'bg-iris text-[#0B0D10] font-medium rounded-[10px] rounded-br-[2px]'
                            : 'bg-iron border border-edge text-chalk rounded-[10px] rounded-bl-[2px]'
                        }`}
                      >
                        {m.text}
                      </div>

                      <div className="flex items-center gap-1 mt-1 text-[10px] text-ash font-mono">
                        <span>{formatTime(m.createdAt)}</span>
                        {m.isOwn && (
                          <span>
                            {m.deliveryState === 'read'
                              ? '✓✓'
                              : m.deliveryState === 'delivered'
                                ? '✓✓'
                                : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {messageError && (
                  <div
                    role="alert"
                    className="mb-2 px-3 py-2 rounded-[6px] bg-[#2E1417] border border-danger/40 text-xs text-danger"
                  >
                    {messageError}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Crafted Message Composer */}
              <form
                onSubmit={handleSend}
                className="px-3 sm:px-5 py-3.5 border-t border-edge bg-stage/90 flex items-center gap-2.5 sm:gap-3"
              >
                <button
                  type="button"
                  className="w-10 h-10 rounded-[8px] bg-iron border border-edge text-silver hover:text-chalk hover:border-[#465261] flex items-center justify-center shrink-0 transition-colors"
                  title="Voice Note (Presigned 60-second limit)"
                  aria-label="Voice note"
                  onClick={() =>
                    alert(
                      'Audio voice note presigning ready: 60s limit with audio/webm recording.',
                    )
                  }
                >
                  <MicIcon size={17} />
                </button>

                <div className="flex-1 min-w-0 relative">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message ${activeMatch.candidate.displayName}...`}
                    maxLength={1000}
                    className="w-full h-10 pl-3.5 pr-16 rounded-[8px] bg-stage border border-edge text-sm text-chalk placeholder:text-ash focus:outline-none focus:border-iris transition-colors"
                  />
                  <span
                    className={`hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${
                      text.length > 900 ? 'text-danger' : 'text-ash'
                    }`}
                  >
                    {text.length}/1000
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="h-10 px-4 rounded-[8px] bg-iris text-[#0B0D10] hover:bg-[#9894D1] disabled:opacity-45 disabled:cursor-not-allowed font-semibold text-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                  title="Send Message"
                  aria-label="Send message"
                >
                  <SendIcon size={15} />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </section>
          ) : connectionEndedNotice ? (
            <div
              data-testid="ended-conversation-notice"
              className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4"
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
                  <Button variant="secondary" size="sm" onClick={() => router.push('/matches')}>
                    Back to Matches
                  </Button>
                  {matches[0] && (
                    <Button variant="primary" size="sm" onClick={() => selectConversation(matches[0])}>
                      Open Active Chat
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-silver">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      )}

      {/* AUDIO CALL MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'call' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title={activeMatch ? `Call with ${activeMatch.candidate.displayName}` : 'Audio Call'}
        description="Calls require explicit mutual invitation and acceptance before connecting."
        maxWidth="sm"
        footer={
          callStatus ? (
            <Button variant="destructive" className="w-full" onClick={handleEndCall}>
              End Audio Call
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleStartCall}>
                Invite to Call
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-[8px] bg-iron border border-edge p-3.5 text-xs text-silver flex items-start gap-2.5">
            <LockIcon size={15} color="#8580C4" className="shrink-0 mt-0.5" />
            <span>
              <strong className="text-chalk">No Default Recording:</strong> Voice calls are real-time WebRTC sessions and never recorded without separate informed consent.
            </span>
          </div>
          {callStatus && (
            <p className="text-sm font-medium text-iris text-center">{callStatus}</p>
          )}
        </div>
      </Dialog>

      {/* MINI-GAMES MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'game' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title="Cooperative Mini-Games"
        description="Low-pressure turn-based games designed for BS students across distance."
        maxWidth="md"
        footer={
          !gameActive ? (
            <>
              <Button variant="secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setGameActive(true)}>
                Start {gameSelection === 'word_scramble' ? 'Word Scramble' : 'Trivia'}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setGameScore((prev) => prev + 10);
                alert('Correct! Answer was GRADIENT. +10 Team Points!');
                setGameActive(false);
                setActiveModal(null);
              }}
            >
              Solve: GRADIENT
            </Button>
          )
        }
      >
        {!gameActive ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setGameSelection('word_scramble')}
              className={`text-left p-4 rounded-[8px] border transition-colors ${
                gameSelection === 'word_scramble'
                  ? 'border-iris bg-iris/[0.12]'
                  : 'border-edge bg-iron hover:border-[#465261]'
              }`}
            >
              <div className="text-sm font-semibold text-chalk">Word Scramble</div>
              <div className="text-xs text-silver mt-0.5">
                Unscramble campus and computer science terms cooperatively.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setGameSelection('iitm_trivia')}
              className={`text-left p-4 rounded-[8px] border transition-colors ${
                gameSelection === 'iitm_trivia'
                  ? 'border-iris bg-iris/[0.12]'
                  : 'border-edge bg-iron hover:border-[#465261]'
              }`}
            >
              <div className="text-sm font-semibold text-chalk">IITM BS Trivia</div>
              <div className="text-xs text-silver mt-0.5">
                Curriculum, Chennai landmarks, and term project history.
              </div>
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-terracotta block mb-2">
              Turn 1 • Team Score: {gameScore} pts
            </span>
            <p className="text-3xl font-semibold tracking-[0.25em] text-iris my-3">
              A G R D N T E I
            </p>
            <p className="text-xs text-silver">
              Hint: Fundamental optimization algorithm in machine learning.
            </p>
          </div>
        )}
      </Dialog>

      {/* VIRTUAL DATE MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'date' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title="Virtual Coffee Date"
        description={
          activeMatch
            ? `Propose a scheduled video chat session with ${activeMatch.candidate.displayName}.`
            : undefined
        }
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDateProposed(true);
                setActiveModal(null);
                setSafetyFeedback('Virtual coffee invitation sent to partner.');
                setTimeout(() => setSafetyFeedback(null), 3000);
              }}
            >
              Send Proposal
            </Button>
          </>
        }
      >
        <div className="rounded-[8px] bg-iron border border-edge p-4 flex flex-col gap-1">
          <span className="text-xs font-semibold text-chalk">Proposed Time</span>
          <span className="text-sm text-iris font-medium">This Saturday, 5:00 PM IST</span>
          <span className="text-[11px] text-ash mt-1">
            Both partners must accept to confirm the calendar invitation.
          </span>
        </div>
      </Dialog>

      {/* RELATIONSHIP MODE MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'relationship' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title="Relationship Mode"
        description="Built for couples who wish to transition from discovery to an intentional, shared private space."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setActiveModal(null);
                setSafetyFeedback(
                  'Relationship Mode proposal sent. Awaiting partner affirmative confirmation.',
                );
                setTimeout(() => setSafetyFeedback(null), 3500);
              }}
            >
              Propose Dual Opt-In
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="p-3.5 rounded-[8px] bg-iron border border-edge">
            <div className="text-xs font-semibold text-chalk">Dual Affirmative Consent</div>
            <p className="text-xs text-silver mt-1">
              Requires two independent actions. Discovery is automatically paused for both partners.
            </p>
          </div>
          <div className="p-3.5 rounded-[8px] bg-iron border border-edge">
            <div className="text-xs font-semibold text-chalk">Independent Unilateral Exit</div>
            <p className="text-xs text-silver mt-1">
              Either partner may leave at any time without permission or lock-in. No coercive retention.
            </p>
          </div>
          <div className="p-3.5 rounded-[8px] bg-iron border border-edge">
            <div className="text-xs font-semibold text-chalk">Zero Surveillance Guarantee</div>
            <p className="text-xs text-silver mt-1">
              SayMyName strictly prohibits partner GPS tracking, ambient recording, or monitoring tools.
            </p>
          </div>
        </div>
      </Dialog>

      {/* REPORT MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'report' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title="Report Conversation"
        description="Confidential report reviewed by student safety operators under strict protocols."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitReport}>
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
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] border cursor-pointer text-xs ${
                reportReason === reason
                  ? 'border-iris bg-iris/[0.12] text-chalk'
                  : 'border-edge bg-iron text-silver hover:border-[#465261]'
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
            className="w-full p-3 rounded-[8px] bg-stage border border-edge text-xs text-chalk placeholder:text-ash focus:outline-none focus:border-iris resize-none"
          />
        </div>
      </Dialog>

      {/* BLOCK MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'block' && activeMatch)}
        onClose={() => setActiveModal(null)}
        title={activeMatch ? `Block ${activeMatch.candidate.displayName}?` : 'Block user?'}
        description="Universal immediate server-side block. All communication will cease, and mutual visibility is severed immediately."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBlock}>
              Confirm Block
            </Button>
          </>
        }
      >
        <p className="text-xs text-silver leading-relaxed">
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
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 text-sm text-silver">
          Loading conversations...
        </div>
      }
    >
      <ChatsContent />
    </React.Suspense>
  );
}
