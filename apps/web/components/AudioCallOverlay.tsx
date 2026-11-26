'use client';

import React from 'react';
import {
  CallUiPhase,
  formatCallDuration,
  getCallingNoticeText,
  isLiveAudioPhase,
} from '../lib/calling-state';
import { Button } from './ui';
import { LockIcon, MicIcon, PhoneIcon } from './icons';

export interface AudioCallOverlayProps {
  phase: CallUiPhase;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  partnerInitials: string;
  elapsedSeconds: number;
  isMuted: boolean;
  endedReason?: string | null;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancelOutgoing: () => void;
  onToggleMute: () => void;
  onEndCall: () => void;
  onDismiss: () => void;
}

export function AudioCallOverlay({
  phase,
  partnerName,
  partnerAvatarUrl,
  partnerInitials,
  elapsedSeconds,
  isMuted,
  endedReason,
  busy = false,
  onAccept,
  onDecline,
  onCancelOutgoing,
  onToggleMute,
  onEndCall,
  onDismiss,
}: AudioCallOverlayProps) {
  if (phase === 'idle') return null;

  const copy = getCallingNoticeText(phase, partnerName, endedReason);
  const liveAudio = isLiveAudioPhase(phase);
  const isOutgoing = phase === 'inviting' || phase === 'ringing_outgoing';
  const isIncoming = phase === 'incoming_ringing';
  const isTerminal = !liveAudio && !isOutgoing && !isIncoming;

  const badgeStyles =
    phase === 'connected'
      ? 'bg-sage/15 text-sage border-sage/35'
      : phase === 'incoming_ringing' || phase === 'inviting' || phase === 'ringing_outgoing'
        ? 'bg-iris/15 text-iris border-iris/35'
        : phase === 'reconnecting' || phase === 'muted' || phase === 'connecting' || phase === 'accepting'
          ? 'bg-warning/15 text-warning border-warning/35'
          : 'bg-danger/15 text-danger border-danger/35';

  return (
    <section
      role="region"
      aria-label="Audio call controls"
      data-testid="audio-call-banner"
      data-call-phase={phase}
      className="mx-3 sm:mx-6 mt-3 rounded-[12px] border border-edge bg-coal/95 shadow-xl px-4 py-3.5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Partner identity + audio status */}
        <div className="flex items-center gap-3 min-w-0">
          {partnerAvatarUrl ? (
            <img
              src={partnerAvatarUrl}
              alt={partnerName}
              className="w-10 h-10 rounded-full object-cover border border-edge shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-steel border border-edge flex items-center justify-center text-xs font-semibold text-chalk shrink-0">
              {partnerInitials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] border text-[11px] font-semibold uppercase tracking-wide ${badgeStyles}`}
              >
                <PhoneIcon size={11} />
                {copy.badge}
              </span>
              {(phase === 'connected' || phase === 'muted') && (
                <span
                  data-testid="call-timer"
                  className="text-xs font-mono text-chalk tabular-nums"
                >
                  {formatCallDuration(elapsedSeconds)}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] text-ash">
                <LockIcon size={11} color="#8580C4" />
                Audio-only · No recording
              </span>
            </div>

            <p className="text-sm font-semibold text-chalk truncate mt-1">
              {copy.title}
            </p>
            <p className="text-xs text-silver leading-snug">{copy.subtitle}</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isIncoming && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onDecline}
                disabled={busy}
                data-testid="call-decline-btn"
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onAccept}
                disabled={busy}
                leftIcon={<PhoneIcon size={14} />}
                data-testid="call-accept-btn"
              >
                Accept Audio
              </Button>
            </>
          )}

          {isOutgoing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onCancelOutgoing}
              disabled={busy}
              data-testid="call-cancel-btn"
            >
              Cancel Call
            </Button>
          )}

          {liveAudio && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleMute}
                aria-pressed={isMuted}
                leftIcon={<MicIcon size={14} />}
                data-testid="call-mute-btn"
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onEndCall}
                disabled={busy}
                data-testid="call-end-btn"
              >
                End Call
              </Button>
            </>
          )}

          {isTerminal && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDismiss}
              data-testid="call-dismiss-btn"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
