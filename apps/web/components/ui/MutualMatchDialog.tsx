'use client';

import React from 'react';
import { LikeResponse } from '../../lib/api';
import { formatProgrammeLabel, getInitials } from '../../lib/discover-state';
import { ThresholdMark } from '../brand/ThresholdMark';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface MutualMatchDialogProps {
  matchResult: LikeResponse | null;
  onClose: () => void;
  onOpenConversation: (matchResult: LikeResponse) => void;
  keepButtonLabel?: string;
  modalTestId?: string;
  openChatTestId?: string;
}

/**
 * Milestone 2 Signature Moment: Mutual Match Confirmation (Document 10 — THE INTERVAL)
 * - Plays the brief (320ms) ThresholdMark alignment animation (static under prefers-reduced-motion)
 * - Zero confetti, zero streak guilt, zero countdown urgency
 * - Equal clear paths to open private chat or continue browsing Discover
 */
export const MutualMatchDialog: React.FC<MutualMatchDialogProps> = ({
  matchResult,
  onClose,
  onOpenConversation,
  keepButtonLabel = 'Keep Discovering',
  modalTestId = 'mutual-match-modal',
  openChatTestId = 'match-open-chat-btn',
}) => {
  const peer = matchResult?.matchedProfile;

  return (
    <Dialog
      isOpen={Boolean(matchResult)}
      onClose={onClose}
      title="It is a mutual match"
      description="You both expressed interest independently. Private conversation is now open."
      maxWidth="sm"
      footer={
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            className="w-full"
          >
            {keepButtonLabel}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => matchResult && onOpenConversation(matchResult)}
            data-testid={openChatTestId}
            className="w-full"
          >
            Open Conversation
          </Button>
        </div>
      }
    >
      <div
        data-testid={modalTestId}
        className="flex flex-col items-center text-center gap-5 py-2"
      >
        <div className="w-full rounded-[10px] border border-edge bg-stage py-6 px-4 flex flex-col items-center justify-center gap-2">
          <ThresholdMark variant="aligned" animate size="md" />
          <span className="text-xs font-medium text-ember">
            Interval aligned · Mutual interest confirmed
          </span>
        </div>

        {peer && (
          <div className="w-full p-4 rounded-[8px] bg-coal border border-edge flex items-center gap-3.5 text-left">
            <div className="w-14 h-14 rounded-[8px] bg-iron border border-edge overflow-hidden shrink-0 flex items-center justify-center text-base font-semibold text-chalk">
              {peer.primaryPhotoUrl ? (
                <img
                  src={peer.primaryPhotoUrl}
                  alt={peer.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(peer.displayName)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-chalk truncate">
                {peer.displayName}
              </p>
              <p className="text-[13px] text-silver truncate">
                {formatProgrammeLabel(peer.programmeFamily)}
              </p>
            </div>
          </div>
        )}

        <p className="text-[13px] text-silver/85 leading-relaxed max-w-sm">
          Say hello whenever both of you are ready. There are no timers or unread read-receipt pressure.
        </p>
      </div>
    </Dialog>
  );
};
