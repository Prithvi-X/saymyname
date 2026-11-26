import { CallStatus } from '@saymyname/contracts';

export type CallUiPhase =
  | 'idle'
  | 'inviting'
  | 'ringing_outgoing'
  | 'incoming_ringing'
  | 'accepting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'muted'
  | 'declined'
  | 'ended'
  | 'missed'
  | 'revoked'
  | 'provider_unavailable'
  | 'mic_permission_denied'
  | 'failed';

export interface ActiveCallSessionModel {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  callStatus: CallStatus | string;
  livekitRoomId: string;
  expiresAt?: string | null;
  endedReason?: string | null;
}

export function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function isLiveAudioPhase(phase: CallUiPhase): boolean {
  return (
    phase === 'accepting' ||
    phase === 'connecting' ||
    phase === 'connected' ||
    phase === 'reconnecting' ||
    phase === 'muted'
  );
}

export function isNonTerminalCallUiPhase(phase: CallUiPhase): boolean {
  return (
    phase === 'inviting' ||
    phase === 'ringing_outgoing' ||
    phase === 'incoming_ringing' ||
    isLiveAudioPhase(phase)
  );
}

export function deriveCallPhaseFromSession(
  session: ActiveCallSessionModel,
  selfAccountId: string | null,
): CallUiPhase {
  const status = String(session.callStatus || '').toLowerCase();
  if (status === 'inviting' || status === 'initiated' || status === 'ringing') {
    if (selfAccountId && session.receiverId === selfAccountId) {
      return 'incoming_ringing';
    }
    if (selfAccountId && session.callerId === selfAccountId) {
      return 'ringing_outgoing';
    }
    return 'ringing_outgoing';
  }
  if (status === 'accepted' || status === 'connecting') {
    return 'connecting';
  }
  if (status === 'active') {
    return 'connected';
  }
  if (status === 'reconnecting') {
    return 'reconnecting';
  }
  return mapCallTerminalPhase(session.endedReason, status);
}

export function mapCallTerminalPhase(
  endedReason?: string | null,
  callStatus?: string | null,
): CallUiPhase {
  const status = String(callStatus || '').toLowerCase();
  const reason = String(endedReason || '').toLowerCase();

  if (
    reason === 'unmatched' ||
    reason === 'match_inactive' ||
    reason === 'verification_revoked' ||
    reason === 'account_suspended' ||
    reason === 'account_deleted' ||
    reason === 'account_disabled' ||
    reason.startsWith('user blocked:')
  ) {
    return 'revoked';
  }

  if (status === 'rejected' || reason === 'declined' || reason === 'recipient_busy') {
    return 'declined';
  }

  if (status === 'missed' || reason === 'invite_timeout') {
    return 'missed';
  }

  if (reason === 'provider_unavailable' || status === 'failed') {
    return 'provider_unavailable';
  }

  return 'ended';
}

export function buildAudioOnlyLiveKitConnectOptions() {
  return {
    autoSubscribe: true,
    publishAudioOnly: true,
    video: false as const,
  };
}

export function getCallingNoticeText(
  phase: CallUiPhase,
  partnerName: string,
  endedReason?: string | null,
): { badge: string; title: string; subtitle: string } {
  const safeName = partnerName || 'your match';
  const reason = String(endedReason || '').toLowerCase();

  switch (phase) {
    case 'inviting':
    case 'ringing_outgoing':
      return {
        badge: 'Ringing',
        title: `Calling ${safeName}...`,
        subtitle: 'Waiting for explicit acceptance. Audio stays off until accepted.',
      };
    case 'incoming_ringing':
      return {
        badge: 'Incoming Audio Call',
        title: `${safeName} wants to start an audio call`,
        subtitle: 'Audio only · No video · Zero default recording.',
      };
    case 'accepting':
    case 'connecting':
      return {
        badge: 'Connecting',
        title: `Connecting audio with ${safeName}`,
        subtitle: 'Securing private audio session...',
      };
    case 'connected':
      return {
        badge: 'Audio Connected',
        title: `On audio call with ${safeName}`,
        subtitle: 'Microphone active · Audio only · Not recorded.',
      };
    case 'muted':
      return {
        badge: 'Muted',
        title: `On audio call with ${safeName}`,
        subtitle: 'Your microphone is muted. You can still hear your match.',
      };
    case 'reconnecting':
      return {
        badge: 'Reconnecting',
        title: `Reconnecting audio with ${safeName}...`,
        subtitle: 'Network interruption detected. Attempting secure reconnect.',
      };
    case 'declined':
      return {
        badge: 'Declined',
        title:
          reason === 'recipient_busy'
            ? `${safeName} is busy right now`
            : `Call declined`,
        subtitle: 'You can continue messaging normally here.',
      };
    case 'missed':
      return {
        badge: 'Missed',
        title: 'Call timed out',
        subtitle: 'The audio call invitation expired before it was accepted.',
      };
    case 'revoked':
      return {
        badge: 'Access Ended',
        title: 'Call closed',
        subtitle: 'This call ended because this connection or verification access is no longer active.',
      };
    case 'provider_unavailable':
      return {
        badge: 'Unavailable',
        title: 'Audio calling is temporarily unavailable',
        subtitle: 'We could not connect to the audio relay right now. Your text chat remains unaffected.',
      };
    case 'mic_permission_denied':
      return {
        badge: 'Mic Blocked',
        title: 'Microphone access needed',
        subtitle: 'Allow microphone permission in your browser settings to speak on the audio call.',
      };
    case 'failed':
      return {
        badge: 'Call Failed',
        title: 'Audio connection could not be maintained',
        subtitle: 'Please try starting a new call once your connection stabilizes.',
      };
    case 'ended':
    default:
      return {
        badge: 'Ended',
        title: reason === 'caller_cancelled' ? 'Call cancelled' : 'Call ended',
        subtitle: 'Microphone released. Thank you for keeping things respectful.',
      };
  }
}
