import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildAudioOnlyLiveKitConnectOptions,
  deriveCallPhaseFromSession,
  formatCallDuration,
  getCallingNoticeText,
  isLiveAudioPhase,
  isNonTerminalCallUiPhase,
  mapCallTerminalPhase,
} from '../lib/calling-state.ts';

describe('Phase 4.1 Audio Calling Frontend State Helpers', () => {
  it('formats elapsed call duration cleanly as M:SS', () => {
    assert.equal(formatCallDuration(0), '0:00');
    assert.equal(formatCallDuration(9), '0:09');
    assert.equal(formatCallDuration(65), '1:05');
    assert.equal(formatCallDuration(612), '10:12');
    assert.equal(formatCallDuration(-5), '0:00');
  });

  it('distinguishes caller vs recipient ringing states strictly without passive auto-accept', () => {
    const baseSession = {
      id: 'call-1',
      conversationId: 'conv-1',
      callerId: 'acc-caller',
      receiverId: 'acc-receiver',
      callStatus: 'inviting',
      livekitRoomId: 'smn_call_abc',
    };

    assert.equal(deriveCallPhaseFromSession(baseSession, 'acc-caller'), 'ringing_outgoing');
    assert.equal(deriveCallPhaseFromSession(baseSession, 'acc-receiver'), 'incoming_ringing');
    assert.equal(
      deriveCallPhaseFromSession({ ...baseSession, callStatus: 'accepted' }, 'acc-caller'),
      'connecting',
    );
    assert.equal(
      deriveCallPhaseFromSession({ ...baseSession, callStatus: 'reconnecting' }, 'acc-receiver'),
      'reconnecting',
    );
  });

  it('maps revocation, decline, timeout, provider outage, and normal hangup to explicit UI phases', () => {
    assert.equal(mapCallTerminalPhase('unmatched', 'ended'), 'revoked');
    assert.equal(mapCallTerminalPhase('User blocked: Safety action', 'ended'), 'revoked');
    assert.equal(mapCallTerminalPhase('verification_revoked', 'ended'), 'revoked');
    assert.equal(mapCallTerminalPhase('account_suspended', 'ended'), 'revoked');
    assert.equal(mapCallTerminalPhase('declined', 'rejected'), 'declined');
    assert.equal(mapCallTerminalPhase('invite_timeout', 'missed'), 'missed');
    assert.equal(mapCallTerminalPhase('provider_unavailable', 'failed'), 'provider_unavailable');
    assert.equal(mapCallTerminalPhase('hangup', 'ended'), 'ended');

    const opts = buildAudioOnlyLiveKitConnectOptions();
    assert.equal(opts.publishAudioOnly, true);
    assert.equal(opts.video, false);
    assert.equal(isLiveAudioPhase('connected'), true);
    assert.equal(isNonTerminalCallUiPhase('incoming_ringing'), true);
    assert.equal(isNonTerminalCallUiPhase('revoked'), false);

    const notice = getCallingNoticeText('revoked', 'Kavya');
    assert.equal(notice.badge, 'Access Ended');
  });
});
