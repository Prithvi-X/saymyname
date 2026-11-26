'use client';

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MAX_TEXT_MESSAGE_LENGTH,
  VOICE_NOTE_MAX_DURATION_SEC,
} from '@saymyname/validation';
import {
  api,
  ChatMessage,
  ConversationListItem,
  DiscoveryCandidate,
  ReportCategory,
} from '../../../lib/api';
import {
  formatCandidateHeading,
  formatCoarseLocation,
  formatProgrammeLabel,
  getInitials,
  REPORT_CATEGORY_OPTIONS,
} from '../../../lib/discover-state';
import { formatMatchDate, getUnmatchDialogContent } from '../../../lib/matches-state';
import {
  clearConversationDraft,
  extractSafeUrlsAndSegments,
  filterConversationsByQuery,
  formatVoiceDuration,
  getCalendarDayKey,
  getMessageDateSeparatorLabel,
  markMessagesDeliveredUpTo,
  mergeChronologicalMessages,
  readConversationDraft,
  saveConversationDraft,
  selectSupportedAudioRecordingMime,
  shouldGroupWithPrevious,
  sortConversationsDeterministically,
} from '../../../lib/chats-state';
import {
  Badge,
  Button,
  Dialog,
  IntervalEmptyComposition,
  Skeleton,
} from '../../../components/ui';
import {
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { VoiceNotePlayer } from '../../../components/VoiceNotePlayer';
import { AudioCallOverlay } from '../../../components/AudioCallOverlay';
import {
  ActiveCallSessionModel,
  CallUiPhase,
  deriveCallPhaseFromSession,
  isLiveAudioPhase,
  isNonTerminalCallUiPhase,
  mapCallTerminalPhase,
} from '../../../lib/calling-state';
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
  InfoIcon,
  RefreshIcon,
  TrashIcon,
  UserIcon,
} from '../../../components/icons';

type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';
type VoiceRecorderStage =
  | 'idle'
  | 'permission_prompt'
  | 'recording'
  | 'preview'
  | 'uploading'
  | 'failed';

function createClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function SafeMessageBody({
  text,
  isOwn,
}: {
  text: string;
  isOwn: boolean;
}) {
  const segments = useMemo(() => extractSafeUrlsAndSegments(text), [text]);
  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((seg, idx) =>
        seg.type === 'link' && seg.href ? (
          <a
            key={idx}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 ${
              isOwn
                ? 'text-[#0B0D10] hover:opacity-80'
                : 'text-iris hover:text-[#ACA8DF]'
            }`}
          >
            {seg.content}
          </a>
        ) : (
          <React.Fragment key={idx}>{seg.content}</React.Fragment>
        ),
      )}
    </span>
  );
}

function ChatsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectMatchId = searchParams.get('matchId');
  const preselectConversationId = searchParams.get('conversationId');

  // Inbox & Active Thread
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [connectionEndedNotice, setConnectionEndedNotice] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlderHistory, setHasOlderHistory] = useState(false);
  const [nextCursorSeq, setNextCursorSeq] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // Composer & Pending/Failed Sends
  const [draftText, setDraftText] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [safetyFeedback, setSafetyFeedback] = useState<string | null>(null);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  // Voice Note Recording State (never auto-records or auto-sends)
  const [voiceStage, setVoiceStage] = useState<VoiceRecorderStage>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBaseMime, setRecordedBaseMime] = useState<string>('audio/webm');
  const [recordedExt, setRecordedExt] = useState<string>('webm');
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [voiceClientUuid, setVoiceClientUuid] = useState<string | null>(null);

  // Realtime WebSocket Connection State
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const unmountedRef = useRef(false);

  // Secondary Modals (Profile Quick View, Report Conversation/Message, Block, Call/Together Entrypoints)
  const [togetherHubOpen, setTogetherHubOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<
    | 'profile'
    | 'call'
    | 'game'
    | 'date'
    | 'relationship'
    | 'unmatch'
    | 'report'
    | 'block'
    | null
  >(null);
  const [reportCategory, setReportCategory] =
    useState<ReportCategory>('harassment');
  const [reportNotes, setReportNotes] = useState('');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [unmatchSubmitting, setUnmatchSubmitting] = useState(false);
  const [unmatchReason, setUnmatchReason] = useState('');

  // Phase 4.1 Audio Calling & Secondary Phase 4 modals
  const [selfAccountId, setSelfAccountId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallSessionModel | null>(null);
  const [callUiPhase, setCallUiPhase] = useState<CallUiPhase>('idle');
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const [callActionBusy, setCallActionBusy] = useState(false);
  const [callEndedReason, setCallEndedReason] = useState<string | null>(null);
  const [gameSelection, setGameSelection] = useState<
    'word_scramble' | 'iitm_trivia'
  >('word_scramble');
  const [gameActive, setGameActive] = useState(false);
  const [gameScore, setGameScore] = useState(0);
  const [dateProposed, setDateProposed] = useState(false);

  // Refs for race-safe async cancellation, scroll anchoring & voice/LiveKit cleanup
  const selfAccountIdRef = useRef<string | null>(null);
  const activeCallRef = useRef<ActiveCallSessionModel | null>(null);
  const callPhaseRef = useRef<CallUiPhase>('idle');
  const callMutedRef = useRef<boolean>(false);
  const livekitRoomRef = useRef<Room | null>(null);
  const remoteAudioHostRef = useRef<HTMLDivElement | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callConnectingRef = useRef<boolean>(false);
  const activeConvRef = useRef<string | null>(null);
  const threadRequestTokenRef = useRef(0);
  const threadContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollOffsetRef = useRef<{
    active: boolean;
    prevScrollHeight: number;
    prevScrollTop: number;
  } | null>(null);
  const shouldStickBottomRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const voicePreviewUrlRef = useRef<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeConvId) || null,
    [conversations, activeConvId],
  );

  const filteredConversations = useMemo(
    () => filterConversationsByQuery(conversations, searchQuery),
    [conversations, searchQuery],
  );

  const cleanupMediaRecorder = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
  }, []);

  const discardVoiceDraft = useCallback(() => {
    cleanupMediaRecorder();
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
      voicePreviewUrlRef.current = null;
    }
    setRecordedPreviewUrl(null);
    setRecordedBlob(null);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    setVoiceClientUuid(null);
    setVoiceError(null);
    setVoiceStage('idle');
  }, [cleanupMediaRecorder]);

  useEffect(() => {
    activeConvRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    selfAccountIdRef.current = selfAccountId;
  }, [selfAccountId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callPhaseRef.current = callUiPhase;
  }, [callUiPhase]);

  useEffect(() => {
    callMutedRef.current = callMuted;
  }, [callMuted]);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const cleanupCallMediaAndRoom = useCallback(() => {
    callConnectingRef.current = false;
    stopCallTimer();
    const room = livekitRoomRef.current;
    livekitRoomRef.current = null;
    if (room) {
      try {
        room.removeAllListeners();
        room.localParticipant?.trackPublications?.forEach((pub) => {
          try {
            pub.track?.stop();
            pub.track?.mediaStreamTrack?.stop();
          } catch {}
        });
        void room.disconnect(true);
      } catch {}
    }
    if (remoteAudioHostRef.current) {
      try {
        remoteAudioHostRef.current.querySelectorAll('audio').forEach((el) => {
          try {
            el.pause();
            el.srcObject = null;
            el.remove();
          } catch {}
        });
      } catch {}
    }
  }, [stopCallTimer]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupCallMediaAndRoom();
    };
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      unmountedRef.current = true;
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupMediaRecorder();
      cleanupCallMediaAndRoom();
      if (voicePreviewUrlRef.current) {
        URL.revokeObjectURL(voicePreviewUrlRef.current);
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, [cleanupMediaRecorder, cleanupCallMediaAndRoom]);

  const refreshConversationsList = useCallback(async (): Promise<
    ConversationListItem[]
  > => {
    const list = sortConversationsDeterministically(await api.getConversations());
    setConversations(list);
    return list;
  }, []);

  const markEndedStateForConversation = useCallback((closedConvId?: string | null) => {
    if (
      activeCallRef.current &&
      (!closedConvId || activeCallRef.current.conversationId === closedConvId)
    ) {
      cleanupCallMediaAndRoom();
      setCallEndedReason('match_inactive');
      setCallUiPhase('revoked');
      setCallMuted(false);
    }
    if (closedConvId) {
      clearConversationDraft(closedConvId);
    }
    setConversations((prev) =>
      closedConvId ? prev.filter((c) => c.conversationId !== closedConvId) : prev,
    );
    if (!closedConvId || activeConvRef.current === closedConvId) {
      setConnectionEndedNotice(true);
      setActiveConvId(null);
      setMessages([]);
      setDraftText('');
      discardVoiceDraft();
      setMobileShowThread(true);
    }
  }, [discardVoiceDraft, cleanupCallMediaAndRoom]);

  const loadConversationInitial = useCallback(
    async (convId: string) => {
      const requestToken = ++threadRequestTokenRef.current;
      setLoadingThread(true);
      setThreadError(null);
      setHasUnreadBelow(false);
      shouldStickBottomRef.current = true;

      try {
        const history = await api.getMessageHistory(convId, { limit: 25 });
        if (
          unmountedRef.current ||
          requestToken !== threadRequestTokenRef.current ||
          activeConvRef.current !== convId
        ) {
          return;
        }
        setMessages((prev) => {
          const failedOrSendingLocal = prev.filter(
            (m) =>
              m.conversationId === convId &&
              (m.localStatus === 'failed' || m.localStatus === 'sending'),
          );
          return mergeChronologicalMessages(failedOrSendingLocal, history.messages);
        });
        setHasOlderHistory(history.hasOlder);
        setNextCursorSeq(
          history.nextCursor ? Number(history.nextCursor) : null,
        );

        const maxSeq =
          history.latestSequenceNo ||
          history.messages[history.messages.length - 1]?.sequenceNo ||
          0;
        if (maxSeq > 0) {
          void api.markInboxSeen(convId, maxSeq).catch(() => null);
          setConversations((prev) =>
            prev.map((c) =>
              c.conversationId === convId ? { ...c, unreadCount: 0 } : c,
            ),
          );
        }
      } catch (err: any) {
        if (requestToken !== threadRequestTokenRef.current) return;
        if (err?.status === 403 || err?.status === 404) {
          markEndedStateForConversation(convId);
        } else {
          setThreadError(
            err?.message || 'Unable to load messages. Please retry.',
          );
        }
      } finally {
        if (requestToken === threadRequestTokenRef.current) {
          setLoadingThread(false);
        }
      }
    },
    [markEndedStateForConversation],
  );

  // Initial Inbox Boot + Self Identity + Deep-link Resolution (?matchId= & ?conversationId=)
  useEffect(() => {
    let cancelled = false;
    async function bootInbox() {
      setLoadingInbox(true);
      setInboxError(null);
      try {
        const [meRes, rawList] = await Promise.all([
          api.getMe().catch(() => null),
          api.getConversations(),
        ]);
        if (cancelled) return;
        if (meRes?.id) {
          selfAccountIdRef.current = meRes.id;
          setSelfAccountId(meRes.id);
        }
        const list = sortConversationsDeterministically(rawList);
        setConversations(list);

        if (preselectMatchId || preselectConversationId) {
          const matched = list.find(
            (c) =>
              (preselectConversationId &&
                c.conversationId === preselectConversationId) ||
              (preselectMatchId && c.matchId === preselectMatchId),
          );
          if (matched) {
            setConnectionEndedNotice(false);
            setActiveConvId(matched.conversationId);
            setDraftText(readConversationDraft(matched.conversationId));
            setMobileShowThread(true);
          } else {
            if (preselectConversationId) {
              clearConversationDraft(preselectConversationId);
            }
            setConnectionEndedNotice(true);
            setActiveConvId(null);
            setMessages([]);
            setMobileShowThread(true);
          }
        } else if (list.length > 0) {
          setConnectionEndedNotice(false);
          setActiveConvId(list[0].conversationId);
          setDraftText(readConversationDraft(list[0].conversationId));
        }
      } catch (err: any) {
        if (!cancelled) {
          setInboxError(
            err?.message || 'Unable to reach private messaging right now.',
          );
        }
      } finally {
        if (!cancelled) setLoadingInbox(false);
      }
    }
    bootInbox();
    return () => {
      cancelled = true;
    };
  }, [preselectMatchId, preselectConversationId]);

  const connectLiveKitAudioRoom = useCallback(
    async (params: {
      livekitUrl: string;
      token: string;
      callSession: ActiveCallSessionModel;
    }) => {
      if (callConnectingRef.current || livekitRoomRef.current) return;
      callConnectingRef.current = true;
      setCallUiPhase('connecting');
      setCallEndedReason(null);

      try {
        await api
          .updateAudioCallState(params.callSession.id, 'connecting')
          .catch(() => null);

        const room = new Room({ adaptiveStream: false, dynacast: false });
        livekitRoomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio || !remoteAudioHostRef.current) return;
          try {
            const el = track.attach() as HTMLAudioElement;
            el.autoplay = true;
            el.dataset.trackSid = track.sid || '';
            remoteAudioHostRef.current.appendChild(el);
          } catch {}
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          try {
            track.detach().forEach((el) => el.remove());
          } catch {}
        });

        room.on(RoomEvent.Reconnecting, () => {
          setCallUiPhase('reconnecting');
          void api
            .updateAudioCallState(params.callSession.id, 'reconnecting')
            .catch(() => null);
          void api.fetchAudioCallToken(params.callSession.id).catch(() => null);
        });

        room.on(RoomEvent.Reconnected, () => {
          setCallUiPhase(callMutedRef.current ? 'muted' : 'connected');
          void api
            .updateAudioCallState(params.callSession.id, 'active')
            .catch(() => null);
        });

        room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          cleanupCallMediaAndRoom();
          const currentPhase = callPhaseRef.current;
          if (currentPhase === 'revoked' || currentPhase === 'mic_permission_denied') {
            return;
          }
          if (
            reason === DisconnectReason.PARTICIPANT_REMOVED ||
            reason === DisconnectReason.ROOM_DELETED
          ) {
            void api
              .getAudioCallSession(params.callSession.id)
              .then((latest) => {
                setActiveCall(latest);
                setCallEndedReason(latest.endedReason ?? null);
                setCallUiPhase(
                  mapCallTerminalPhase(latest.endedReason, latest.callStatus),
                );
              })
              .catch(() => {
                setCallEndedReason('match_inactive');
                setCallUiPhase('revoked');
              });
            return;
          }
          if (isLiveAudioPhase(currentPhase)) {
            setCallEndedReason('hangup');
            setCallUiPhase('ended');
          }
        });

        await room.connect(params.livekitUrl, params.token, {
          autoSubscribe: true,
        });

        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setCallMuted(false);
        } catch {
          cleanupCallMediaAndRoom();
          setCallUiPhase('mic_permission_denied');
          setCallEndedReason('mic_permission_denied');
          void api.endAudioCall(params.callSession.id).catch(() => null);
          return;
        }

        await api
          .updateAudioCallState(params.callSession.id, 'active')
          .catch(() => null);
        setCallUiPhase('connected');
        setCallElapsedSeconds(0);
        stopCallTimer();
        callTimerRef.current = setInterval(() => {
          setCallElapsedSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        cleanupCallMediaAndRoom();
        if (err?.status === 403) {
          setCallUiPhase('revoked');
          setCallEndedReason('match_inactive');
        } else {
          setCallUiPhase('provider_unavailable');
          setCallEndedReason('provider_unavailable');
        }
      } finally {
        callConnectingRef.current = false;
      }
    },
    [cleanupCallMediaAndRoom, stopCallTimer],
  );

  const connectLiveKitRef = useRef(connectLiveKitAudioRoom);
  useEffect(() => {
    connectLiveKitRef.current = connectLiveKitAudioRoom;
  }, [connectLiveKitAudioRoom]);

  const handleInitiateAudioCall = useCallback(async () => {
    if (!activeConvRef.current || callActionBusy) return;
    const convId = activeConvRef.current;
    setCallActionBusy(true);
    setActiveModal(null);
    setCallEndedReason(null);
    setCallUiPhase('inviting');

    try {
      const res = await api.inviteAudioCall(convId);
      setActiveCall(res.callSession);
      setCallUiPhase('ringing_outgoing');
    } catch (err: any) {
      if (err?.status === 409) {
        try {
          const existing = await api.getActiveAudioCall(convId);
          if (existing.activeCall) {
            setActiveCall(existing.activeCall);
            setCallUiPhase(
              deriveCallPhaseFromSession(
                existing.activeCall,
                selfAccountIdRef.current,
              ),
            );
            return;
          }
        } catch {}
        setCallUiPhase('failed');
      } else if (err?.status === 403 || err?.status === 404) {
        markEndedStateForConversation(convId);
      } else {
        setCallEndedReason('provider_unavailable');
        setCallUiPhase('provider_unavailable');
      }
    } finally {
      setCallActionBusy(false);
    }
  }, [callActionBusy, markEndedStateForConversation]);

  const handleAcceptIncomingCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || callActionBusy) return;
    setCallActionBusy(true);
    setCallUiPhase('accepting');
    try {
      const res = await api.respondAudioCall(call.id, 'accept');
      const updatedSession: ActiveCallSessionModel = {
        ...call,
        callStatus: res.callStatus,
      };
      setActiveCall(updatedSession);
      if (!res.livekitUrl || !res.token) {
        setCallUiPhase('provider_unavailable');
        return;
      }
      await connectLiveKitAudioRoom({
        livekitUrl: res.livekitUrl,
        token: res.token,
        callSession: updatedSession,
      });
    } catch (err: any) {
      cleanupCallMediaAndRoom();
      if (err?.status === 403 || err?.status === 404) {
        setCallEndedReason('match_inactive');
        setCallUiPhase('revoked');
      } else if (err?.status === 409) {
        setCallEndedReason('invite_timeout');
        setCallUiPhase('missed');
      } else {
        setCallEndedReason('provider_unavailable');
        setCallUiPhase('provider_unavailable');
      }
    } finally {
      setCallActionBusy(false);
    }
  }, [callActionBusy, cleanupCallMediaAndRoom, connectLiveKitAudioRoom]);

  const handleDeclineIncomingCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || callActionBusy) return;
    setCallActionBusy(true);
    try {
      await api.respondAudioCall(call.id, 'decline');
      cleanupCallMediaAndRoom();
      setCallEndedReason('declined');
      setCallUiPhase('declined');
    } catch {
      cleanupCallMediaAndRoom();
      setCallUiPhase('ended');
    } finally {
      setCallActionBusy(false);
    }
  }, [callActionBusy, cleanupCallMediaAndRoom]);

  const handleCancelOutgoingCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || callActionBusy) return;
    setCallActionBusy(true);
    try {
      await api.respondAudioCall(call.id, 'cancel');
      cleanupCallMediaAndRoom();
      setCallEndedReason('caller_cancelled');
      setCallUiPhase('ended');
    } catch {
      cleanupCallMediaAndRoom();
      setCallUiPhase('ended');
    } finally {
      setCallActionBusy(false);
    }
  }, [callActionBusy, cleanupCallMediaAndRoom]);

  const handleToggleCallMute = useCallback(async () => {
    const room = livekitRoomRef.current;
    const nextMuted = !callMutedRef.current;
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      } catch {
        return;
      }
    }
    setCallMuted(nextMuted);
    if (callPhaseRef.current === 'connected' || callPhaseRef.current === 'muted') {
      setCallUiPhase(nextMuted ? 'muted' : 'connected');
    }
  }, []);

  const handleEndCall = useCallback(async () => {
    const call = activeCallRef.current;
    setCallActionBusy(true);
    cleanupCallMediaAndRoom();
    try {
      if (call) {
        await api.endAudioCall(call.id);
      }
    } catch {
      // Idempotent UI cleanup even if network already dropped
    } finally {
      setCallMuted(false);
      setCallEndedReason('hangup');
      setCallUiPhase('ended');
      setCallActionBusy(false);
    }
  }, [cleanupCallMediaAndRoom]);

  const handleDismissCallNotice = useCallback(() => {
    cleanupCallMediaAndRoom();
    setActiveCall(null);
    setCallEndedReason(null);
    setCallElapsedSeconds(0);
    setCallMuted(false);
    setCallUiPhase('idle');
  }, [cleanupCallMediaAndRoom]);

  // Load thread + any active/ringing audio call whenever active conversation changes
  useEffect(() => {
    if (!activeConvId) return;
    setMessages([]);
    setHasOlderHistory(false);
    setNextCursorSeq(null);
    discardVoiceDraft();
    void loadConversationInitial(activeConvId);

    void api
      .getActiveAudioCall(activeConvId)
      .then((res) => {
        if (activeConvRef.current !== activeConvId) return;
        if (res.activeCall && !isLiveAudioPhase(callPhaseRef.current)) {
          setActiveCall(res.activeCall);
          setCallUiPhase(
            deriveCallPhaseFromSession(res.activeCall, selfAccountIdRef.current),
          );
        }
      })
      .catch(() => null);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(
          JSON.stringify({
            event: 'conversation.subscribe',
            data: { conversationId: activeConvId },
          }),
        );
      } catch {}
    }
  }, [activeConvId, loadConversationInitial, discardVoiceDraft]);

  // Reconcile missed messages from PostgreSQL after WebSocket connect/reconnect
  const reconcileActiveConversation = useCallback(
    async (convId: string) => {
      try {
        const latestConfirmedSeq = messages
          .filter(
            (m) =>
              m.conversationId === convId &&
              !m.localStatus &&
              typeof m.sequenceNo === 'number',
          )
          .reduce((max, m) => (m.sequenceNo > max ? m.sequenceNo : max), 0);

        const delta = await api.getMessageHistory(convId, {
          afterSeq: latestConfirmedSeq,
          limit: 50,
        });
        if (activeConvRef.current !== convId) return;
        if (delta.messages.length > 0) {
          setMessages((prev) =>
            mergeChronologicalMessages(prev, delta.messages),
          );
          const newMax =
            delta.latestSequenceNo ||
            delta.messages[delta.messages.length - 1]?.sequenceNo ||
            latestConfirmedSeq;
          if (newMax > 0) {
            void api.markInboxSeen(convId, newMax).catch(() => null);
          }
          if (!shouldStickBottomRef.current) {
            setHasUnreadBelow(true);
          }
        }
        void refreshConversationsList().catch(() => null);
      } catch (err: any) {
        if (err?.status === 403 || err?.status === 404) {
          markEndedStateForConversation(convId);
        }
      }
    },
    [messages, markEndedStateForConversation, refreshConversationsList],
  );

  // Keep latest callback ref for WebSocket handler without reconnect churn
  const reconcileRef = useRef(reconcileActiveConversation);
  useEffect(() => {
    reconcileRef.current = reconcileActiveConversation;
  }, [reconcileActiveConversation]);

  // Real-Time WebSocket Lifecycle with BFF Single-Use Ticket + Reconnection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let stopped = false;

    const connectRealtime = async () => {
      if (stopped || unmountedRef.current) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setRealtimeStatus('offline');
        return;
      }

      setRealtimeStatus(
        reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting',
      );

      let ticketInfo: { ticket: string; wsUrl: string };
      try {
        ticketInfo = await api.issueRealtimeWsTicket();
      } catch (err: any) {
        if (stopped || unmountedRef.current) return;
        if (err?.status === 401 || err?.status === 403) {
          setRealtimeStatus('reconnecting');
          return;
        }
        const delayMs = Math.min(
          15_000,
          1000 * Math.pow(2, reconnectAttemptRef.current),
        );
        reconnectAttemptRef.current += 1;
        setRealtimeStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(connectRealtime, delayMs);
        return;
      }

      if (stopped || unmountedRef.current) return;

      let ws: WebSocket;
      try {
        // Strictly NO credentials/tickets inside WebSocket URL (Part 07 §7.3 #7)
        ws = new WebSocket(ticketInfo.wsUrl);
      } catch {
        setRealtimeStatus('reconnecting');
        return;
      }
      wsRef.current = ws;

      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      ws.onopen = () => {
        try {
          ws.send(
            JSON.stringify({
              event: 'authenticate',
              data: { ticket: ticketInfo.ticket },
            }),
          );
        } catch {}
      };

      ws.onmessage = (evt) => {
        let envelope: any;
        try {
          envelope = JSON.parse(String(evt.data || '{}'));
        } catch {
          return;
        }

        const eventType = envelope?.eventType;
        if (eventType === 'connection.established') {
          reconnectAttemptRef.current = 0;
          setRealtimeStatus('connected');

          if (activeConvRef.current) {
            try {
              ws.send(
                JSON.stringify({
                  event: 'conversation.subscribe',
                  data: { conversationId: activeConvRef.current },
                }),
              );
            } catch {}
            void reconcileRef.current(activeConvRef.current);
          }

          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ event: 'ping', data: {} }));
              } catch {}
            }
          }, 25_000);
          return;
        }

        if (eventType === 'message.created') {
          const convId = envelope?.data?.conversationId;
          if (!convId) return;
          if (activeConvRef.current === convId) {
            void reconcileRef.current(convId);
          } else {
            void refreshConversationsList().catch(() => null);
          }
          return;
        }

        if (eventType === 'message.delivered') {
          const convId = envelope?.data?.conversationId;
          const upToSeq = Number(envelope?.data?.upToSequenceNo || 0);
          if (convId && upToSeq > 0 && activeConvRef.current === convId) {
            setMessages((prev) => markMessagesDeliveredUpTo(prev, upToSeq));
          }
          return;
        }

        if (eventType === 'call.invited') {
          const callSessionId = envelope?.data?.callSessionId;
          if (!callSessionId) return;
          void api
            .getAudioCallSession(callSessionId)
            .then((session) => {
              if (unmountedRef.current) return;
              setActiveCall(session);
              setCallEndedReason(null);
              const nextPhase = deriveCallPhaseFromSession(
                session,
                selfAccountIdRef.current,
              );
              setCallUiPhase(nextPhase);
              if (nextPhase === 'incoming_ringing') {
                void api.updateAudioCallState(session.id, 'ringing').catch(() => null);
              }
            })
            .catch(() => null);
          return;
        }

        if (eventType === 'call.accepted') {
          const callSessionId = envelope?.data?.callSessionId;
          if (!callSessionId) return;
          void api
            .getAudioCallSession(callSessionId)
            .then(async (session) => {
              if (unmountedRef.current) return;
              setActiveCall(session);
              if (
                selfAccountIdRef.current &&
                session.callerId === selfAccountIdRef.current &&
                !livekitRoomRef.current &&
                !callConnectingRef.current
              ) {
                const tok = await api.fetchAudioCallToken(session.id);
                if (tok.livekitUrl && tok.token) {
                  await connectLiveKitRef.current({
                    livekitUrl: tok.livekitUrl,
                    token: tok.token,
                    callSession: session,
                  });
                }
              }
            })
            .catch(() => null);
          return;
        }

        if (eventType === 'call.state_changed') {
          const callSessionId = envelope?.data?.callSessionId;
          const status = envelope?.data?.status;
          if (
            callSessionId &&
            activeCallRef.current?.id === callSessionId &&
            !isLiveAudioPhase(callPhaseRef.current)
          ) {
            setActiveCall((prev) =>
              prev ? { ...prev, callStatus: status || prev.callStatus } : prev,
            );
          }
          return;
        }

        if (eventType === 'call.ended') {
          const callSessionId = envelope?.data?.callSessionId;
          const status = envelope?.data?.status;
          const endedReason = envelope?.data?.endedReason ?? null;
          if (
            !callSessionId ||
            activeCallRef.current?.id === callSessionId ||
            isNonTerminalCallUiPhase(callPhaseRef.current)
          ) {
            cleanupCallMediaAndRoom();
            setCallMuted(false);
            setCallEndedReason(endedReason);
            if (callPhaseRef.current !== 'mic_permission_denied') {
              setCallUiPhase(mapCallTerminalPhase(endedReason, status));
            }
          }
          return;
        }

        if (
          eventType === 'conversation.closed' ||
          eventType === 'access.revoked' ||
          eventType === 'authorization.failed'
        ) {
          const convId =
            envelope?.data?.conversationId || envelope?.aggregate?.id || null;
          if (
            eventType === 'access.revoked' ||
            (convId && activeConvRef.current === convId)
          ) {
            markEndedStateForConversation(convId);
          } else if (convId) {
            setConversations((prev) =>
              prev.filter((c) => c.conversationId !== convId),
            );
          }
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (stopped || unmountedRef.current) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setRealtimeStatus('offline');
          return;
        }
        const delayMs = Math.min(
          15_000,
          1000 * Math.pow(2, reconnectAttemptRef.current),
        );
        reconnectAttemptRef.current += 1;
        setRealtimeStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(connectRealtime, delayMs);
      };

      ws.onerror = () => {
        // Closed handler triggers backoff reconnect cleanly
      };
    };

    const handleOnline = () => {
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      void connectRealtime();
    };
    const handleOffline = () => {
      setRealtimeStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void connectRealtime();

    return () => {
      stopped = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, [markEndedStateForConversation, refreshConversationsList]);

  // Preserve scroll position smoothly when prepending older history vs sticking near bottom on new messages
  useLayoutEffect(() => {
    const container = threadContainerRef.current;
    if (!container) return;

    if (preserveScrollOffsetRef.current?.active) {
      const { prevScrollHeight, prevScrollTop } = preserveScrollOffsetRef.current;
      const heightDiff = container.scrollHeight - prevScrollHeight;
      container.scrollTop = Math.max(0, prevScrollTop + heightDiff);
      preserveScrollOffsetRef.current = null;
      return;
    }

    if (shouldStickBottomRef.current) {
      container.scrollTop = container.scrollHeight;
      setHasUnreadBelow(false);
    }
  }, [messages]);

  const handleThreadScroll = () => {
    const el = threadContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 120;
    shouldStickBottomRef.current = nearBottom;
    if (nearBottom) {
      setHasUnreadBelow(false);
    }
  };

  const handleLoadOlderHistory = async () => {
    if (!activeConvId || !nextCursorSeq || loadingOlder) return;
    const container = threadContainerRef.current;
    if (container) {
      preserveScrollOffsetRef.current = {
        active: true,
        prevScrollHeight: container.scrollHeight,
        prevScrollTop: container.scrollTop,
      };
    }

    setLoadingOlder(true);
    try {
      const page = await api.getMessageHistory(activeConvId, {
        beforeSeq: nextCursorSeq,
        limit: 25,
      });
      if (activeConvRef.current !== activeConvId) return;
      setMessages((prev) => mergeChronologicalMessages(page.messages, prev));
      setHasOlderHistory(page.hasOlder);
      setNextCursorSeq(page.nextCursor ? Number(page.nextCursor) : null);
    } catch (err: any) {
      preserveScrollOffsetRef.current = null;
      if (err?.status === 403 || err?.status === 404) {
        markEndedStateForConversation(activeConvId);
      } else {
        setThreadError(err?.message || 'Unable to load earlier messages.');
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  const selectConversation = (conv: ConversationListItem) => {
    setConnectionEndedNotice(false);
    setThreadError(null);
    setActiveConvId(conv.conversationId);
    setDraftText(readConversationDraft(conv.conversationId));
    setTogetherHubOpen(false);
    setMobileShowThread(true);
  };

  const submitTextMessageWithUuid = async (
    targetConvId: string,
    bodyText: string,
    clientAssignedUuid: string,
  ) => {
    shouldStickBottomRef.current = true;
    setSendingText(true);
    setThreadError(null);

    const pendingMsg: ChatMessage = {
      id: `pending-${clientAssignedUuid}`,
      conversationId: targetConvId,
      sequenceNo: Number.MAX_SAFE_INTEGER - 1,
      senderId: 'self',
      senderName: 'You',
      messageType: 'text',
      text: bodyText,
      createdAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      createdAtIso: new Date().toISOString(),
      isOwn: true,
      deliveryState: 'sent',
      clientAssignedUuid,
      localStatus: 'sending',
    };

    setMessages((prev) => mergeChronologicalMessages(prev, [pendingMsg]));

    try {
      const confirmed = await api.sendMessage(targetConvId, bodyText, {
        clientAssignedUuid,
        idempotencyKey: clientAssignedUuid,
      });
      if (activeConvRef.current === targetConvId) {
        setMessages((prev) =>
          mergeChronologicalMessages(
            prev.filter((m) => m.clientAssignedUuid !== clientAssignedUuid),
            [confirmed],
          ),
        );
      }
      clearConversationDraft(targetConvId);
      void refreshConversationsList().catch(() => null);
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        setMessages((prev) =>
          prev.filter((m) => m.clientAssignedUuid !== clientAssignedUuid),
        );
        markEndedStateForConversation(targetConvId);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientAssignedUuid === clientAssignedUuid
              ? { ...m, localStatus: 'failed' }
              : m,
          ),
        );
        setThreadError(
          err?.message || 'Message could not be confirmed. You can retry safely.',
        );
      }
    } finally {
      setSendingText(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConvId || sendingText || connectionEndedNotice) return;

    const trimmed = draftText.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TEXT_MESSAGE_LENGTH) {
      setThreadError(
        `Message exceeds ${MAX_TEXT_MESSAGE_LENGTH.toLocaleString()} character limit.`,
      );
      return;
    }

    const convId = activeConvId;
    const clientUuid = createClientUuid();
    setDraftText('');
    clearConversationDraft(convId);
    await submitTextMessageWithUuid(convId, trimmed, clientUuid);
  };

  const handleRetryFailedMessage = async (failedMsg: ChatMessage) => {
    if (!activeConvId || !failedMsg.clientAssignedUuid || sendingText) return;
    await submitTextMessageWithUuid(
      activeConvId,
      failedMsg.text,
      failedMsg.clientAssignedUuid,
    );
  };

  const handleDiscardFailedMessage = (clientAssignedUuid?: string | null) => {
    if (!clientAssignedUuid) return;
    setMessages((prev) =>
      prev.filter((m) => m.clientAssignedUuid !== clientAssignedUuid),
    );
  };

  // Explicit Voice Note Recording Flow (User-initiated, previewable, discardable)
  const beginVoiceRecorderPrompt = () => {
    if (!activeConvId || connectionEndedNotice) return;
    setVoiceError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setVoiceError(
        'Audio recording is unavailable in this browser. You can continue chatting via text.',
      );
      setVoiceStage('failed');
      return;
    }
    const supported = selectSupportedAudioRecordingMime();
    if (!supported) {
      setVoiceError(
        'No compatible audio recording codec was found in this browser.',
      );
      setVoiceStage('failed');
      return;
    }
    setVoiceStage('permission_prompt');
  };

  const startVoiceRecording = async () => {
    const supported = selectSupportedAudioRecordingMime();
    if (!supported || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone recording is not supported on this device.');
      setVoiceStage('failed');
      return;
    }

    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];
      setRecordedBaseMime(supported.baseMime);
      setRecordedExt(supported.extension);

      const recorder = new MediaRecorder(stream, { mimeType: supported.mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordingChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        const blob = new Blob(recordingChunksRef.current, {
          type: supported.baseMime,
        });
        if (blob.size < 64 || recordingSecondsRef.current < 1) {
          setVoiceError('Recording was too short. Please record at least 1 second.');
          setVoiceStage('failed');
          return;
        }
        if (voicePreviewUrlRef.current) {
          URL.revokeObjectURL(voicePreviewUrlRef.current);
        }
        const preview = URL.createObjectURL(blob);
        voicePreviewUrlRef.current = preview;
        setRecordedBlob(blob);
        setRecordedPreviewUrl(preview);
        setVoiceClientUuid(createClientUuid());
        setVoiceStage('preview');
      };

      recorder.onerror = () => {
        setVoiceError('Recording was interrupted.');
        setVoiceStage('failed');
        cleanupMediaRecorder();
      };

      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recorder.start(250);
      setVoiceStage('recording');

      recordingIntervalRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= VOICE_NOTE_MAX_DURATION_SEC) {
          // Strict Doc 04 MSG-16: stop into preview state at cap, NEVER auto-send!
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Microphone permission was declined. Enable mic access in browser settings or send text instead.'
          : 'Could not start microphone recording.';
      setVoiceError(msg);
      setVoiceStage('failed');
    }
  };

  const stopVoiceRecordingForPreview = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (recordingSecondsRef.current < 1) {
        recordingSecondsRef.current = 1;
        setRecordingSeconds(1);
      }
      mediaRecorderRef.current.stop();
    }
  };

  const uploadAndSendVoiceNote = async () => {
    if (!activeConvId || !recordedBlob || voiceStage === 'uploading') return;
    const convId = activeConvId;
    const clientUuid = voiceClientUuid || createClientUuid();
    setVoiceClientUuid(clientUuid);
    setVoiceStage('uploading');
    setVoiceError(null);

    const safeDuration = Math.max(
      1,
      Math.min(VOICE_NOTE_MAX_DURATION_SEC, recordingSecondsRef.current || recordingSeconds || 1),
    );

    try {
      const presigned = await api.presignMessagingVoiceNote(convId, {
        filename: `voice_note.${recordedExt}`,
        mimeType: recordedBaseMime,
        durationSeconds: safeDuration,
        fileSizeBytes: recordedBlob.size,
      });

      if (presigned.uploadUrl) {
        await api.uploadBlobToPresignedUrl(
          presigned.uploadUrl,
          recordedBlob,
          recordedBaseMime,
        );
      }

      const confirmed = await api.sendMessagingVoiceNote(
        convId,
        {
          mediaRefId: presigned.mediaRefId,
          uploadToken: presigned.uploadToken,
          durationSeconds: safeDuration,
          clientAssignedUuid: clientUuid,
        },
        clientUuid,
      );

      if (activeConvRef.current === convId) {
        shouldStickBottomRef.current = true;
        setMessages((prev) => mergeChronologicalMessages(prev, [confirmed]));
      }
      discardVoiceDraft();
      void refreshConversationsList().catch(() => null);
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        discardVoiceDraft();
        markEndedStateForConversation(convId);
      } else {
        setVoiceError(
          err?.message ||
            'Voice note upload failed. Your recording is preserved — tap Retry.',
        );
        setVoiceStage('failed');
      }
    }
  };

  // Safety Actions (Message/Voice-Note Report & Conversation Block)
  const openReportDialog = (messageId?: string | null) => {
    setReportMessageId(messageId || null);
    setReportCategory('harassment');
    setReportNotes('');
    setActiveModal('report');
  };

  const submitReport = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!activeConversation || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const description = reportNotes.trim() || undefined;
      await api.reportCandidate(
        activeConversation.profile.profileId,
        reportCategory,
        description,
        createClientUuid(),
        {
          conversationId: activeConversation.conversationId,
          ...(reportMessageId ? { messageId: reportMessageId } : {}),
        },
      );
      setActiveModal(null);
      setReportMessageId(null);
      setReportNotes('');
      setSafetyFeedback(
        'Confidential report queued for safety review. You may also Block or Unmatch separately if needed.',
      );
    } catch (err: any) {
      setThreadError(err?.message || 'Unable to submit report right now.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const confirmBlock = async () => {
    if (!activeConversation || blockSubmitting) return;
    setBlockSubmitting(true);
    const blockedName = activeConversation.profile.displayName;
    const blockedConvId = activeConversation.conversationId;
    try {
      await api.blockCandidate(
        activeConversation.profile.profileId,
        'Blocked from private chat conversation',
      );
      setActiveModal(null);
      clearConversationDraft(blockedConvId);
      setSafetyFeedback(
        `${blockedName} has been permanently blocked. Conversation and mutual visibility are disabled.`,
      );
      const remaining = conversations.filter(
        (c) => c.conversationId !== blockedConvId,
      );
      setConversations(remaining);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].conversationId);
        setDraftText(readConversationDraft(remaining[0].conversationId));
      } else {
        setActiveConvId(null);
        setConnectionEndedNotice(true);
        setMobileShowThread(false);
      }
    } catch (err: any) {
      setThreadError(err?.message || 'Unable to apply safety block right now.');
    } finally {
      setBlockSubmitting(false);
    }
  };

  const confirmUnmatch = async () => {
    if (!activeConversation || unmatchSubmitting) return;
    setUnmatchSubmitting(true);
    const endedName = activeConversation.profile.displayName;
    const endedConvId = activeConversation.conversationId;
    try {
      await api.unmatch(
        activeConversation.matchId,
        unmatchReason.trim() || undefined,
        createClientUuid(),
      );
      setActiveModal(null);
      setUnmatchReason('');
      clearConversationDraft(endedConvId);
      setSafetyFeedback(
        `Unmatched ${endedName}. Private messaging has closed cleanly; no safety block or report was applied.`,
      );
      markEndedStateForConversation(endedConvId);
    } catch (err: any) {
      setThreadError(err?.message || 'Unable to end connection right now.');
    } finally {
      setUnmatchSubmitting(false);
    }
  };

  const conversationStarters = activeConversation
    ? [
        `Hey ${activeConversation.profile.displayName}, glad we matched! How is your term going in ${formatProgrammeLabel(activeConversation.profile.programmeFamily)}?`,
        ...(activeConversation.profile.interests?.slice(0, 1).map(
          (interest) =>
            `I noticed we share an interest in ${interest} — what got you into it?`,
        ) || []),
      ]
    : [];

  const activePartner: DiscoveryCandidate | null =
    activeConversation?.profile || null;

  if (loadingInbox) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-8 font-ui">
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
    <div
      className={`max-w-[1320px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-6 pb-[72px] md:pb-6 font-ui flex flex-col gap-2.5 sm:gap-3 ${
        !inboxError && conversations.length > 0
          ? 'h-[calc(100dvh-67px)] overflow-hidden md:h-auto md:overflow-visible'
          : ''
      }`}
    >
      {/* Always-mounted Hidden Audio Output Sink for LiveKit Remote Tracks */}
      <div ref={remoteAudioHostRef} className="sr-only" aria-hidden="true" />

      {/* Mobile Inbox & Cross-Conversation Audio Call Visibility */}
      {callUiPhase !== 'idle' &&
        (!activePartner ||
          (activeCall && activeCall.conversationId !== activeConvId) ||
          !mobileShowThread) && (
          <div
            className={
              !activePartner ||
              (activeCall && activeCall.conversationId !== activeConvId)
                ? 'block'
                : 'md:hidden'
            }
          >
            <AudioCallOverlay
              phase={callUiPhase}
              partnerName={
                conversations.find(
                  (c) => c.conversationId === activeCall?.conversationId,
                )?.profile.displayName ||
                activePartner?.displayName ||
                'Match'
              }
              partnerAvatarUrl={
                conversations.find(
                  (c) => c.conversationId === activeCall?.conversationId,
                )?.profile.photos?.[0]?.photoUrl ||
                activePartner?.photos?.[0]?.photoUrl ||
                null
              }
              partnerInitials={getInitials(
                conversations.find(
                  (c) => c.conversationId === activeCall?.conversationId,
                )?.profile.displayName ||
                  activePartner?.displayName ||
                  'Match',
              )}
              elapsedSeconds={callElapsedSeconds}
              isMuted={callMuted}
              endedReason={callEndedReason}
              busy={callActionBusy}
              onAccept={() => void handleAcceptIncomingCall()}
              onDecline={() => void handleDeclineIncomingCall()}
              onCancelOutgoing={() => void handleCancelOutgoingCall()}
              onToggleMute={() => void handleToggleCallMute()}
              onEndCall={() => void handleEndCall()}
              onDismiss={handleDismissCallNotice}
            />
          </div>
        )}

      {safetyFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-[8px] bg-coal border border-iris/50 text-xs sm:text-sm text-chalk flex items-center justify-between gap-3"
        >
          <span>{safetyFeedback}</span>
          <button
            type="button"
            onClick={() => setSafetyFeedback(null)}
            className="text-xs text-ash hover:text-chalk px-2 py-1 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {inboxError ? (
        <IntervalEmptyComposition
          testId="chats-error-state"
          variant="chats"
          eyebrow="Connection Interrupted"
          title="Unable to load your conversations"
          description={inboxError}
          primaryAction={{
            label: 'Retry',
            onClick: () => void refreshConversationsList(),
            variant: 'primary',
          }}
          secondaryAction={{
            label: 'Back to Matches',
            onClick: () => router.push('/matches'),
            variant: 'secondary',
          }}
        />
      ) : conversations.length === 0 ? (
        <div className="pt-2">
          {connectionEndedNotice ? (
            <IntervalEmptyComposition
              testId="ended-conversation-notice"
              variant="chats"
              eyebrow="Connection Closed"
              title="This connection has ended"
              description="The mutual match linked to this conversation is no longer active. Messaging and voice playback are closed, and new messages cannot be sent."
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
              testId="chats-empty-state"
              variant="chats"
              eyebrow="Bilateral Channels"
              title="No active conversations yet"
              description="SayMyName strictly prohibits unsolicited stranger DMs. Private messaging opens exclusively after two verified students mutually match."
              primaryAction={{
                label: 'Explore Discover',
                onClick: () => router.push('/discover'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Check Matches',
                onClick: () => router.push('/matches'),
                variant: 'secondary',
              }}
              facts={[
                { label: 'Messaging Rule', value: 'Active mutual match required' },
                { label: 'Presence Policy', value: 'No last-seen or forced read receipts' },
              ]}
            />
          )}
        </div>
      ) : (
        <div className="rounded-[12px] border border-edge bg-coal smn-surface-elevated overflow-hidden flex flex-col md:flex-row flex-1 min-h-0 md:flex-none md:h-[calc(100vh-118px)] md:min-h-[580px]">
          {/* Left Rail: Conversations Inbox */}
          <aside
            aria-label="Conversation channels"
            className={`${
              mobileShowThread ? 'hidden md:flex' : 'flex'
            } w-full md:w-[300px] lg:w-[336px] shrink-0 border-b md:border-b-0 md:border-r border-edge bg-stage/95 flex-col min-h-0`}
          >
            <div className="px-4 sm:px-5 py-4 border-b border-edge flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ash">
                    Private Channels
                  </span>
                  <h1 className="text-lg font-semibold text-chalk tracking-tight mt-0.5">
                    Conversations
                  </h1>
                </div>
                <Badge variant="neutral" size="sm">
                  {conversations.length} active
                </Badge>
              </div>

              {conversations.length > 2 && (
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter conversations..."
                  aria-label="Filter conversations"
                  className="w-full h-9 px-3 rounded-[6px] bg-coal border border-edge text-xs text-chalk placeholder:text-ash focus:outline-none focus:border-iris"
                />
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-edge/40">
              {filteredConversations.length === 0 ? (
                <div className="p-5 text-xs text-ash text-center">
                  No conversations match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected =
                    !connectionEndedNotice &&
                    activeConversation?.conversationId === c.conversationId;
                  const photo = c.profile.photos?.[0]?.photoUrl;
                  return (
                    <button
                      key={c.conversationId}
                      type="button"
                      data-testid={`conversation-item-${c.conversationId}`}
                      onClick={() => selectConversation(c)}
                      className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors border-l-[3px] ${
                        isSelected
                          ? 'bg-iron/90 border-iris'
                          : 'bg-transparent border-transparent hover:bg-coal/80'
                      }`}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={c.profile.displayName}
                          className="w-11 h-11 rounded-[8px] object-cover shrink-0 border border-edge"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-[8px] bg-iron border border-edge text-chalk flex items-center justify-center font-semibold text-sm shrink-0">
                          {getInitials(c.profile.displayName)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-chalk truncate">
                            {c.profile.displayName}
                          </span>
                          <span className="text-[10px] text-ash shrink-0">
                            {formatMatchDate(c.lastMessageAt || c.matchedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-silver truncate">
                            {c.lastMessage
                              ? `${c.lastMessage.isOwn ? 'You: ' : ''}${c.lastMessage.previewText}`
                              : 'Mutual match unlocked'}
                          </p>
                          {c.unreadCount > 0 && (
                            <span
                              data-testid={`unread-badge-${c.conversationId}`}
                              aria-label={`${c.unreadCount} unread messages`}
                              className="px-1.5 py-0.5 rounded-[4px] bg-iris text-[#0B0D10] text-[10px] font-bold font-mono shrink-0"
                            >
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Pane: Conversation Workspace OR Closed Notice */}
          {connectionEndedNotice ? (
            <div
              data-testid="ended-conversation-notice"
              className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-void/70 text-center"
            >
              <div className="max-w-md flex flex-col items-center gap-3">
                <Badge variant="neutral" size="sm">
                  Connection Closed
                </Badge>
                <h2 className="text-lg font-semibold text-chalk">
                  This connection is no longer active
                </h2>
                <p className="text-sm text-silver leading-relaxed">
                  Private messaging and voice media for this match have closed. Other active connections remain accessible in your list.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/matches')}
                  >
                    Back to Matches
                  </Button>
                  {conversations[0] && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => selectConversation(conversations[0])}
                    >
                      Open Active Chat
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : activeConversation && activePartner ? (
            <section
              aria-label={`Conversation with ${activePartner.displayName}`}
              className={`${
                mobileShowThread ? 'flex' : 'hidden md:flex'
              } flex-1 flex-col min-w-0 min-h-0 bg-coal`}
            >
              {/* Thread Header (zero online/last-seen/typing exposure) */}
              <div className="px-3.5 sm:px-6 py-3 border-b border-edge bg-stage/75 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 h-9 rounded-[6px] border border-edge bg-iron text-xs font-medium text-chalk shrink-0"
                    aria-label="Back to conversations list"
                  >
                    &larr; Chats
                  </button>

                  {activePartner.photos?.[0]?.photoUrl ? (
                    <img
                      src={activePartner.photos[0].photoUrl}
                      alt={activePartner.displayName}
                      className="w-10 h-10 rounded-[8px] object-cover border border-edge shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-[8px] bg-iron border border-edge text-chalk flex items-center justify-center font-semibold text-sm shrink-0">
                      {getInitials(activePartner.displayName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveModal('profile')}
                        className="text-left text-base font-semibold text-chalk hover:text-iris truncate transition-colors"
                      >
                        {formatCandidateHeading(
                          activePartner.displayName,
                          activePartner.age,
                        )}
                      </button>
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
                      {formatProgrammeLabel(activePartner.programmeFamily)}
                    </p>
                  </div>
                </div>

                {/* Conversation & Safety Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap relative">
                  <button
                    type="button"
                    onClick={() => setActiveModal('profile')}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] border border-edge/80 bg-iron/70 text-silver hover:text-chalk hover:border-[#465261] transition-colors"
                    aria-label="Inspect partner profile"
                    title="View Match Profile"
                  >
                    <InfoIcon size={15} />
                  </button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveModal('call')}
                    disabled={isNonTerminalCallUiPhase(callUiPhase)}
                    leftIcon={<PhoneIcon size={14} />}
                    title="Audio Call (Requires Mutual Acceptance)"
                    data-testid="open-chat-call-btn"
                  >
                    <span className="hidden sm:inline">Call</span>
                  </Button>

                  <div className="relative hidden sm:block">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTogetherHubOpen((prev) => !prev)}
                      leftIcon={<GameIcon size={14} />}
                      className="border border-edge bg-iron/80 text-chalk"
                      title="Together Space"
                    >
                      Together
                    </Button>

                    {togetherHubOpen && (
                      <div className="absolute right-0 mt-2 w-60 rounded-[10px] border border-edge bg-coal shadow-2xl z-40 overflow-hidden divide-y divide-edge">
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
                    onClick={() => setActiveModal('unmatch')}
                    className="inline-flex items-center justify-center px-2.5 h-9 rounded-[6px] border border-edge/80 bg-iron/60 text-xs font-medium text-silver hover:text-chalk hover:border-[#465261] transition-colors"
                    aria-label="Unmatch"
                    title="Unmatch without blocking"
                    data-testid="open-chat-unmatch-btn"
                  >
                    Unmatch
                  </button>

                  <button
                    type="button"
                    onClick={() => openReportDialog(null)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] border border-edge/80 bg-iron/60 text-ash hover:text-warning hover:border-warning/50 transition-colors"
                    aria-label="Report conversation"
                    title="Report Conversation"
                  >
                    <FlagIcon size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModal('block')}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] border border-edge/80 bg-iron/60 text-ash hover:text-danger hover:border-danger/50 transition-colors"
                    aria-label="Block user"
                    title="Block User"
                  >
                    <ShieldIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Privacy Notice & Realtime Status Strip */}
              <div className="px-4 sm:px-6 py-2 bg-iron/50 border-b border-edge/70 text-[11px] text-silver flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LockIcon size={12} color="#8580C4" />
                  <span>
                    Mutual Match Active &middot; No default call recording, ad targeting, or forced read receipts.
                  </span>
                </div>
                {realtimeStatus !== 'connected' && (
                  <span
                    data-testid="realtime-status-pill"
                    role="status"
                    className={`px-2 py-0.5 rounded-[4px] border text-[10px] font-medium ${
                      realtimeStatus === 'offline'
                        ? 'bg-[#2E1417] border-danger/50 text-danger'
                        : 'bg-stage border-edge text-silver'
                    }`}
                  >
                    {realtimeStatus === 'offline'
                      ? 'Offline · Drafts preserved locally'
                      : realtimeStatus === 'reconnecting'
                        ? 'Reconnecting realtime...'
                        : 'Connecting...'}
                  </span>
                )}
              </div>

              {callUiPhase !== 'idle' &&
                (!activeCall || activeCall.conversationId === activeConvId) && (
                <AudioCallOverlay
                  phase={callUiPhase}
                  partnerName={
                    conversations.find(
                      (c) => c.conversationId === activeCall?.conversationId,
                    )?.profile.displayName || activePartner.displayName
                  }
                  partnerAvatarUrl={
                    conversations.find(
                      (c) => c.conversationId === activeCall?.conversationId,
                    )?.profile.photos?.[0]?.photoUrl ||
                    activePartner.photos?.[0]?.photoUrl ||
                    null
                  }
                  partnerInitials={getInitials(
                    conversations.find(
                      (c) => c.conversationId === activeCall?.conversationId,
                    )?.profile.displayName || activePartner.displayName,
                  )}
                  elapsedSeconds={callElapsedSeconds}
                  isMuted={callMuted}
                  endedReason={callEndedReason}
                  busy={callActionBusy}
                  onAccept={() => void handleAcceptIncomingCall()}
                  onDecline={() => void handleDeclineIncomingCall()}
                  onCancelOutgoing={() => void handleCancelOutgoingCall()}
                  onToggleMute={() => void handleToggleCallMute()}
                  onEndCall={() => void handleEndCall()}
                  onDismiss={handleDismissCallNotice}
                />
              )}

              {/* Scrollable Message Thread Body */}
              <div
                ref={threadContainerRef}
                onScroll={handleThreadScroll}
                className="flex-1 min-h-[260px] overflow-y-auto px-3.5 sm:px-6 py-5 bg-void/70"
              >
                <div className="max-w-[740px] mx-auto flex flex-col gap-3">
                  {hasOlderHistory && (
                    <div className="flex justify-center pb-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={loadingOlder}
                        disabled={loadingOlder}
                        onClick={handleLoadOlderHistory}
                        data-testid="load-older-messages-btn"
                      >
                        Load earlier messages
                      </Button>
                    </div>
                  )}

                  {loadingThread && messages.length === 0 ? (
                    <div className="flex flex-col gap-3 py-4">
                      <Skeleton width="55%" height="44px" rounded="control" />
                      <Skeleton width="42%" height="44px" rounded="control" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div
                      data-testid="new-conversation-threshold"
                      className="my-auto rounded-[12px] border border-edge bg-coal/90 p-5 sm:p-6 flex flex-col gap-4"
                    >
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-edge/80">
                        <div>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris">
                            <SparklesIcon size={12} />
                            <span>Mutual Match Established</span>
                          </span>
                          <h2 className="text-lg font-semibold text-chalk mt-1">
                            Begin chatting with {activePartner.displayName}
                          </h2>
                          <p className="text-xs text-silver mt-0.5">
                            {formatProgrammeLabel(activePartner.programmeFamily)}
                            {activePartner.currentTerm
                              ? ` · ${activePartner.currentTerm}`
                              : ''}
                          </p>
                        </div>
                        <Badge variant="verified" size="sm">
                          Verified
                        </Badge>
                      </div>

                      {activePartner.bio?.trim() && (
                        <p className="text-xs text-silver leading-relaxed border-l-2 border-edge pl-3">
                          {activePartner.bio}
                        </p>
                      )}

                      {activePartner.interests &&
                        activePartner.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {activePartner.interests.slice(0, 5).map((item) => (
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
                          Draft an opening note (never auto-sent)
                        </span>
                        <div className="flex flex-col gap-2">
                          {conversationStarters.map((starter, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setDraftText(starter);
                                saveConversationDraft(
                                  activeConversation.conversationId,
                                  starter,
                                );
                              }}
                              className="text-left px-3.5 py-2.5 rounded-[8px] bg-iron/80 border border-edge hover:border-iris/60 text-xs text-chalk transition-colors"
                            >
                              &ldquo;{starter}&rdquo;
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const prev = idx > 0 ? messages[idx - 1] : undefined;
                      const prevDay = prev
                        ? getCalendarDayKey(prev.createdAtIso || prev.createdAt)
                        : null;
                      const currDay = getCalendarDayKey(
                        m.createdAtIso || m.createdAt,
                      );
                      const showDateSeparator = idx === 0 || prevDay !== currDay;
                      const grouped = !showDateSeparator && shouldGroupWithPrevious(prev, m);
                      const isVoice = m.messageType === 'voice_note';

                      return (
                        <React.Fragment key={m.id}>
                          {showDateSeparator && (
                            <div
                              data-testid="date-separator"
                              className="flex items-center justify-center my-2"
                            >
                              <span className="px-2.5 py-0.5 rounded-[4px] bg-stage border border-edge text-[10px] font-semibold uppercase tracking-[0.12em] text-ash">
                                {getMessageDateSeparatorLabel(
                                  m.createdAtIso || m.createdAt,
                                )}
                              </span>
                            </div>
                          )}

                          <div
                            data-testid={`message-row-${m.id}`}
                            className={`group flex flex-col max-w-[88%] sm:max-w-[74%] ${
                              m.isOwn
                                ? 'self-end items-end'
                                : 'self-start items-start'
                            } ${grouped ? '-mt-1.5' : ''}`}
                          >
                            <div className="flex items-end gap-1.5">
                              {!m.isOwn && (
                                <button
                                  type="button"
                                  onClick={() => openReportDialog(m.id)}
                                  aria-label={`Report ${isVoice ? 'voice note' : 'message'}`}
                                  title={`Report this ${isVoice ? 'voice note' : 'message'}`}
                                  className="order-2 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1 rounded-[4px] text-ash hover:text-warning transition-opacity"
                                >
                                  <FlagIcon size={12} />
                                </button>
                              )}

                              <div
                                className={`px-3.5 sm:px-4 py-2.5 text-sm leading-relaxed ${
                                  m.isOwn
                                    ? 'bg-iris text-[#0B0D10] font-medium rounded-[10px] rounded-br-[2px]'
                                    : 'bg-iron border border-edge text-chalk rounded-[10px] rounded-bl-[2px]'
                                } ${
                                  m.localStatus === 'failed'
                                    ? 'ring-1 ring-danger/80'
                                    : ''
                                }`}
                              >
                                {isVoice ? (
                                  <VoiceNotePlayer
                                    mediaId={m.mediaId}
                                    initialUrl={m.mediaUrl}
                                    durationSeconds={m.durationSeconds}
                                    isOwn={m.isOwn}
                                    onMediaAccessDenied={() =>
                                      markEndedStateForConversation(
                                        activeConversation.conversationId,
                                      )
                                    }
                                  />
                                ) : (
                                  <SafeMessageBody
                                    text={m.text}
                                    isOwn={m.isOwn}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[10px] text-ash font-mono">
                              <span>{m.createdAt}</span>
                              {m.isOwn && (
                                <span data-testid={`msg-status-${m.id}`}>
                                  {m.localStatus === 'sending'
                                    ? 'Sending...'
                                    : m.localStatus === 'failed'
                                      ? 'Failed'
                                      : m.deliveryState === 'delivered'
                                        ? 'Delivered'
                                        : 'Sent'}
                                </span>
                              )}
                              {m.localStatus === 'failed' && (
                                <span className="inline-flex items-center gap-2 font-ui">
                                  <button
                                    type="button"
                                    onClick={() => handleRetryFailedMessage(m)}
                                    data-testid={`retry-msg-${m.id}`}
                                    className="text-iris hover:underline font-semibold inline-flex items-center gap-1"
                                  >
                                    <RefreshIcon size={11} />
                                    Retry
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDiscardFailedMessage(
                                        m.clientAssignedUuid,
                                      )
                                    }
                                    className="text-ash hover:text-chalk"
                                  >
                                    Discard
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}

                  {threadError && (
                    <div
                      role="alert"
                      data-testid="thread-error-banner"
                      className="mt-2 px-3.5 py-2.5 rounded-[8px] bg-[#2E1417] border border-danger/50 text-xs text-danger flex items-center justify-between gap-2"
                    >
                      <span>{threadError}</span>
                      <button
                        type="button"
                        onClick={() => setThreadError(null)}
                        className="text-[11px] underline shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {hasUnreadBelow && (
                <div className="px-4 py-1.5 bg-stage/90 border-t border-edge flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      shouldStickBottomRef.current = true;
                      const el = threadContainerRef.current;
                      if (el) {
                        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                      }
                      setHasUnreadBelow(false);
                    }}
                    className="px-3 py-1 rounded-[6px] bg-iron border border-iris/50 text-xs text-chalk hover:bg-coal"
                  >
                    Jump to latest messages
                  </button>
                </div>
              )}

              {/* Voice Note Recording / Preview / Retry Strip (explicit user-controlled lifecycle) */}
              {voiceStage !== 'idle' && (
                <div
                  data-testid="voice-recorder-panel"
                  className="px-3.5 sm:px-5 py-3 border-t border-edge bg-stage flex flex-col gap-2.5"
                >
                  {voiceStage === 'permission_prompt' && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-silver">
                        <strong className="text-chalk">Voice Note (Max 60s):</strong>{' '}
                        Recording begins only after you grant microphone permission and lets you listen or discard before sending.
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={discardVoiceDraft}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={startVoiceRecording}
                          data-testid="voice-allow-record-btn"
                        >
                          Allow Mic &amp; Record
                        </Button>
                      </div>
                    </div>
                  )}

                  {voiceStage === 'recording' && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-chalk">
                        <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                        <span className="font-mono font-semibold">
                          Recording {formatVoiceDuration(recordingSeconds)} /{' '}
                          {formatVoiceDuration(VOICE_NOTE_MAX_DURATION_SEC)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={discardVoiceDraft}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={stopVoiceRecordingForPreview}
                          data-testid="voice-stop-btn"
                        >
                          Stop &amp; Preview
                        </Button>
                      </div>
                    </div>
                  )}

                  {(voiceStage === 'preview' ||
                    voiceStage === 'uploading' ||
                    voiceStage === 'failed') && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        {recordedPreviewUrl ? (
                          <audio
                            controls
                            src={recordedPreviewUrl}
                            className="h-9 max-w-[260px]"
                          />
                        ) : null}
                        <span className="text-xs text-ash font-mono">
                          {recordedBlob
                            ? `${formatVoiceDuration(recordingSeconds)} · ${Math.max(1, Math.round(recordedBlob.size / 1024))} KB`
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<TrashIcon size={13} />}
                          disabled={voiceStage === 'uploading'}
                          onClick={discardVoiceDraft}
                          data-testid="voice-discard-btn"
                        >
                          Discard
                        </Button>
                        {recordedBlob && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={voiceStage === 'uploading'}
                            disabled={voiceStage === 'uploading'}
                            onClick={uploadAndSendVoiceNote}
                            data-testid="voice-send-btn"
                          >
                            {voiceStage === 'failed'
                              ? 'Retry Voice Note'
                              : 'Send Voice Note'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {voiceError && (
                    <p role="alert" className="text-xs text-danger">
                      {voiceError}
                    </p>
                  )}
                </div>
              )}

              {/* Message Composer (accessible multiline input, mobile safe-area friendly) */}
              <form
                onSubmit={handleSend}
                className="px-3 sm:px-5 py-3 border-t border-edge bg-stage/95 flex items-end gap-2 sm:gap-3"
              >
                <button
                  type="button"
                  onClick={beginVoiceRecorderPrompt}
                  disabled={voiceStage !== 'idle'}
                  className="w-10 h-10 rounded-[8px] bg-iron border border-edge text-silver hover:text-chalk hover:border-[#465261] disabled:opacity-45 flex items-center justify-center shrink-0 transition-colors"
                  title="Record Voice Note (60-second limit)"
                  aria-label="Voice note"
                  data-testid="open-voice-note-btn"
                >
                  <MicIcon size={17} />
                </button>

                <div className="flex-1 min-w-0 relative">
                  <textarea
                    rows={1}
                    value={draftText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftText(val);
                      if (activeConvId) saveConversationDraft(activeConvId, val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={`Message ${activePartner.displayName}...`}
                    maxLength={MAX_TEXT_MESSAGE_LENGTH}
                    aria-label={`Message ${activePartner.displayName}`}
                    className="w-full min-h-[40px] max-h-[112px] py-2 pl-3 sm:pl-3.5 pr-3 sm:pr-16 rounded-[8px] bg-stage border border-edge text-[13px] sm:text-sm text-chalk placeholder:text-ash placeholder:truncate focus:outline-none focus:border-iris transition-colors resize-none leading-snug"
                  />
                  <span
                    className={`hidden sm:inline absolute right-3 bottom-2.5 text-[10px] font-mono ${
                      draftText.length > 900 ? 'text-danger' : 'text-ash'
                    }`}
                  >
                    {draftText.length}/{MAX_TEXT_MESSAGE_LENGTH}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!draftText.trim() || sendingText}
                  className="h-10 px-3.5 sm:px-4 rounded-[8px] bg-iris text-[#0B0D10] hover:bg-[#9894D1] disabled:opacity-45 disabled:cursor-not-allowed font-semibold text-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                  aria-label="Send message"
                >
                  <SendIcon size={15} />
                  <span>{sendingText ? 'Sending' : 'Send'}</span>
                </button>
              </form>
            </section>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center p-8 text-sm text-silver">
              Select an active mutual conversation to view or continue chatting.
            </div>
          )}
        </div>
      )}

      {/* MATCH PROFILE QUICK VIEW DIALOG */}
      <Dialog
        isOpen={Boolean(activeModal === 'profile' && activePartner)}
        onClose={() => setActiveModal(null)}
        title={
          activePartner
            ? formatCandidateHeading(activePartner.displayName, activePartner.age)
            : 'Match Profile'
        }
        description={
          activePartner
            ? formatProgrammeLabel(activePartner.programmeFamily)
            : undefined
        }
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/matches')}
            >
              Manage in Matches
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveModal(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {activePartner && (
          <div className="flex flex-col gap-3 text-xs text-silver">
            <div className="flex items-center gap-3">
              {activePartner.photos?.[0]?.photoUrl ? (
                <img
                  src={activePartner.photos[0].photoUrl}
                  alt={activePartner.displayName}
                  className="w-16 h-16 rounded-[8px] object-cover border border-edge shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-chalk font-semibold">
                  <UserIcon size={20} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-chalk font-medium">
                  {activePartner.ageVisible && activePartner.age !== null
                    ? `Age ${activePartner.age}`
                    : 'Age set to private'}
                </span>
                {formatCoarseLocation(
                  activePartner.locationCity,
                  activePartner.locationState,
                ) && (
                  <span>
                    {formatCoarseLocation(
                      activePartner.locationCity,
                      activePartner.locationState,
                    )}
                  </span>
                )}
              </div>
            </div>
            {activePartner.bio && (
              <p className="leading-relaxed border-l-2 border-edge pl-3">
                {activePartner.bio}
              </p>
            )}
          </div>
        )}
      </Dialog>

      {/* PHASE 4.1 AUDIO CALL CONSENT INVITATION DIALOG */}
      <Dialog
        isOpen={Boolean(activeModal === 'call' && activePartner)}
        onClose={() => setActiveModal(null)}
        title={activePartner ? `Audio call with ${activePartner.displayName}` : 'Audio Call'}
        description="Calls are audio-only and require explicit acceptance before any microphone audio connects."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={callActionBusy}
              disabled={callActionBusy || isNonTerminalCallUiPhase(callUiPhase)}
              onClick={() => void handleInitiateAudioCall()}
              leftIcon={<PhoneIcon size={14} />}
              data-testid="confirm-request-call-btn"
            >
              Request Audio Call
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-[8px] bg-iron border border-edge p-3.5 text-xs text-silver flex items-start gap-2.5">
            <LockIcon size={15} color="#8580C4" className="shrink-0 mt-0.5" />
            <span>
              <strong className="text-chalk">Privacy &amp; Safety:</strong> Microphone stays off until {activePartner?.displayName || 'your match'} accepts. Video, screen sharing, and call recording are disabled.
            </span>
          </div>
        </div>
      </Dialog>

      {/* MINI-GAMES MODAL (Preserved secondary entry-point) */}
      <Dialog
        isOpen={Boolean(activeModal === 'game' && activePartner)}
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
                Preview{' '}
                {gameSelection === 'word_scramble' ? 'Word Scramble' : 'Trivia'}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setGameScore((prev) => prev + 10);
                setGameActive(false);
                setActiveModal(null);
              }}
            >
              Close Preview
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
              Team Score: {gameScore} pts
            </span>
            <p className="text-xs text-silver">
              Multiplayer turn-based synchronization continues in Phase 4 Together Space.
            </p>
          </div>
        )}
      </Dialog>

      {/* VIRTUAL DATE MODAL (Preserved secondary entry-point) */}
      <Dialog
        isOpen={Boolean(activeModal === 'date' && activePartner)}
        onClose={() => setActiveModal(null)}
        title="Virtual Coffee Date"
        description={
          activePartner
            ? `Schedule a mutual virtual hangout with ${activePartner.displayName}.`
            : undefined
        }
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDateProposed(true);
                setActiveModal(null);
                setSafetyFeedback(
                  'Virtual coffee scheduling preview saved for Phase 4.',
                );
              }}
            >
              Acknowledge
            </Button>
          </>
        }
      >
        <div className="rounded-[8px] bg-iron border border-edge p-4 text-xs text-silver">
          Both partners must explicitly consent before any virtual date session confirms.
        </div>
      </Dialog>

      {/* RELATIONSHIP MODE MODAL (Preserved secondary entry-point) */}
      <Dialog
        isOpen={Boolean(activeModal === 'relationship' && activePartner)}
        onClose={() => setActiveModal(null)}
        title="Relationship Mode"
        description="Opt-in mutual space requiring two independent affirmative actions and allowing unilateral exit anytime."
        maxWidth="md"
        footer={
          <Button variant="primary" onClick={() => setActiveModal(null)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-xs text-silver">
          <div className="p-3.5 rounded-[8px] bg-iron border border-edge">
            <div className="font-semibold text-chalk">Dual Consent &amp; Independent Exit</div>
            <p className="mt-1">
              Zero surveillance, zero GPS tracking, and either partner can exit independently without permission.
            </p>
          </div>
        </div>
      </Dialog>

      {/* REPORT CONVERSATION OR MESSAGE/VOICE NOTE MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'report' && activePartner)}
        onClose={() => {
          if (!reportSubmitting) setActiveModal(null);
        }}
        title={
          reportMessageId
            ? 'Report Message or Voice Note'
            : 'Report Conversation'
        }
        description="Confidential report reviewed by student safety operators under strict protocols."
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={reportSubmitting}
              onClick={() => setActiveModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={reportSubmitting}
              disabled={reportSubmitting}
              onClick={submitReport}
              data-testid="confirm-chat-report-btn"
            >
              Submit Report
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          {REPORT_CATEGORY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 px-3.5 py-2.5 rounded-[8px] border cursor-pointer text-xs ${
                reportCategory === opt.value
                  ? 'border-iris bg-iris/[0.12] text-chalk'
                  : 'border-edge bg-iron text-silver hover:border-[#465261]'
              }`}
            >
              <input
                type="radio"
                name="chatReportCategory"
                checked={reportCategory === opt.value}
                onChange={() => setReportCategory(opt.value)}
                className="accent-iris mt-0.5"
              />
              <div>
                <div className="font-medium text-chalk">{opt.label}</div>
                <div className="text-[11px] text-ash">{opt.description}</div>
              </div>
            </label>
          ))}

          <textarea
            rows={3}
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            maxLength={1000}
            placeholder="Additional context (optional)..."
            className="w-full p-3 rounded-[8px] bg-stage border border-edge text-xs text-chalk placeholder:text-ash focus:outline-none focus:border-iris resize-none mt-1"
          />
        </div>
      </Dialog>

      {/* DIRECT UNMATCH MODAL (Distinct from Block/Report — closes bilateral channel cleanly) */}
      <Dialog
        isOpen={Boolean(activeModal === 'unmatch' && activePartner)}
        onClose={() => {
          if (!unmatchSubmitting) setActiveModal(null);
        }}
        title={
          activePartner
            ? getUnmatchDialogContent(activePartner.displayName).title
            : 'End connection?'
        }
        description={
          activePartner
            ? getUnmatchDialogContent(activePartner.displayName).description
            : undefined
        }
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={unmatchSubmitting}
              onClick={() => setActiveModal(null)}
              data-testid="cancel-chat-unmatch-btn"
            >
              Keep Match
            </Button>
            <Button
              variant="destructive"
              isLoading={unmatchSubmitting}
              disabled={unmatchSubmitting}
              onClick={confirmUnmatch}
              data-testid="confirm-chat-unmatch-btn"
            >
              Unmatch
            </Button>
          </>
        }
      >
        <div
          data-testid="chat-unmatch-dialog"
          className="flex flex-col gap-3 text-xs text-silver leading-relaxed"
        >
          {activePartner && (
            <p>{getUnmatchDialogContent(activePartner.displayName).explanation}</p>
          )}
          <input
            type="text"
            value={unmatchReason}
            onChange={(e) => setUnmatchReason(e.target.value)}
            maxLength={300}
            placeholder="Optional note (private, never shared with partner)"
            aria-label="Optional private unmatch note"
            className="w-full h-9 px-3 rounded-[6px] bg-stage border border-edge text-xs text-chalk placeholder:text-ash focus:outline-none focus:border-iris"
          />
        </div>
      </Dialog>

      {/* BLOCK MODAL */}
      <Dialog
        isOpen={Boolean(activeModal === 'block' && activePartner)}
        onClose={() => {
          if (!blockSubmitting) setActiveModal(null);
        }}
        title={activePartner ? `Block ${activePartner.displayName}?` : 'Block user?'}
        description="Blocking ends this match and closes the conversation immediately across both accounts."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={blockSubmitting}
              onClick={() => setActiveModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={blockSubmitting}
              disabled={blockSubmitting}
              onClick={confirmBlock}
              data-testid="confirm-chat-block-btn"
            >
              Block Permanently
            </Button>
          </>
        }
      >
        <p className="text-xs text-silver leading-relaxed">
          To end a connection without applying a safety block, use Unmatch instead.
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
