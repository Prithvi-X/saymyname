import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { TokenVerifier } from 'livekit-server-sdk';
import { CallingService } from '../src/modules/calling/calling.service';
import {
  CallingProviderUnavailableError,
  LiveKitProviderAdapter,
} from '../src/modules/calling/livekit-provider.adapter';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { CallStatus } from '@saymyname/contracts';

function createTestLiveKitAdapter(options?: { failEnsure?: boolean }) {
  process.env.NODE_ENV = 'test';
  process.env.LIVEKIT_URL = 'ws://127.0.0.1:7880';
  process.env.LIVEKIT_API_KEY = 'APItestkey123';
  process.env.LIVEKIT_API_SECRET = '0123456789abcdef0123456789abcdef';
  process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS = '300';

  const adapter = new LiveKitProviderAdapter();
  const createdRooms: string[] = [];
  const evictedRooms: string[] = [];
  let failEnsure = Boolean(options?.failEnsure);

  (adapter as any).ensureAudioRoom = async ({ roomId }: { roomId: string }) => {
    if (failEnsure) {
      throw new CallingProviderUnavailableError('Simulated LiveKit SFU outage');
    }
    createdRooms.push(roomId);
  };
  (adapter as any).deleteRoom = async (roomId: string) => {
    evictedRooms.push(roomId);
    return 'deleted';
  };
  (adapter as any).evictSession = async ({ roomId, callSessionId, participantAccountIds }: any) => {
    evictedRooms.push(roomId);
    return {
      outcome: 'evicted',
      participantIdentities: participantAccountIds.map((id: string) =>
        adapter.buildParticipantIdentity(callSessionId, id),
      ),
      roomDeleted: 'deleted',
    };
  };

  return {
    adapter,
    createdRooms,
    evictedRooms,
    setFailEnsure: (v: boolean) => {
      failEnsure = v;
    },
  };
}

describe('CallingService (Phase 4.1 Audio Calling Lifecycle & Legacy Voice Note Compatibility)', () => {
  const cryptoService = new CryptoService();
  const mockPrisma: any = {};

  const testUserId = 'a1111111-1111-1111-1111-111111111111';
  const partnerId = 'a2222222-2222-2222-2222-222222222222';
  const outsiderId = 'a3333333-3333-3333-3333-333333333333';

  it('presigns voice note within 60s limit with supported audio mime type', async () => {
    const lk = createTestLiveKitAdapter();
    const callingService = new CallingService(mockPrisma, cryptoService, undefined, lk.adapter);
    const res = await callingService.presignVoiceNote(testUserId, {
      filename: 'voice_message.m4a',
      mimeType: 'audio/m4a',
      durationSeconds: 42,
    });

    assert.ok(res.uploadUrl);
    assert.ok(res.mediaRefId);
    assert.ok(res.s3Key.includes('voice_notes/'));
    assert.equal(res.expiresInSeconds, 300);
  });

  it('rejects voice note exceeding 60-second limit (Doc 02 §4.3)', async () => {
    const lk = createTestLiveKitAdapter();
    const callingService = new CallingService(mockPrisma, cryptoService, undefined, lk.adapter);
    await assert.rejects(
      () =>
        callingService.presignVoiceNote(testUserId, {
          filename: 'long_ramble.mp3',
          mimeType: 'audio/mp3',
          durationSeconds: 61,
        }),
      { name: 'BadRequestException' },
    );
  });

  it('initiates 1:1 audio call invitation WITHOUT pre-accept join token and enforces single active call', async () => {
    const lk = createTestLiveKitAdapter();
    const broadcasted: any[] = [];
    const mockBus: any = {
      publishConversationEvent: (convId: string, eventType: string, data: any) =>
        broadcasted.push({ convId, eventType, data }),
    };
    const callingService = new CallingService(mockPrisma, cryptoService, undefined, lk.adapter, mockBus);
    const convId = 'c1111111-1111-1111-1111-111111111111';

    const inviteRes = await callingService.inviteCall(testUserId, {
      conversationId: convId,
    });

    assert.ok(inviteRes.callSession.id);
    assert.equal(inviteRes.callSession.callStatus, CallStatus.INVITING);
    assert.equal(inviteRes.callSession.callType, 'audio');
    assert.ok(inviteRes.callSession.livekitRoomId.startsWith('smn_call_'));
    assert.equal('token' in (inviteRes as any), false);
    assert.ok(inviteRes.expiresAt);
    assert.equal(lk.createdRooms.length, 1);
    assert.equal(broadcasted[0].eventType, 'call.invited');

    // Second simultaneous invite on same conversation fails with ConflictException (409)
    await assert.rejects(
      () => callingService.inviteCall(partnerId, { conversationId: convId }),
      { name: 'ConflictException' },
    );

    // Caller cannot fetch join token BEFORE recipient acceptance
    await assert.rejects(
      () => callingService.issueJoinToken(testUserId, inviteRes.callSession.id),
      { name: 'ConflictException' },
    );
  });

  it('receiver accepts call, receives short-lived audio-only LiveKit token, caller fetches post-accept token & reconnect works', async () => {
    const lk = createTestLiveKitAdapter();
    const callingService = new CallingService(mockPrisma, cryptoService, undefined, lk.adapter);
    const convId = 'c2222222-2222-2222-2222-222222222222';

    const inviteRes = await callingService.inviteCall(testUserId, {
      conversationId: convId,
    });
    const callId = inviteRes.callSession.id;

    // Non-recipient cannot accept or mark ringing
    await assert.rejects(
      () => callingService.respondToCall(testUserId, callId, { action: 'accept' }),
      { name: 'ForbiddenException' },
    );
    await assert.rejects(
      () => callingService.respondToCall(outsiderId, callId, { action: 'accept' }),
      { name: 'ForbiddenException' },
    );

    // Recipient confirms ringing
    const ringRes = await callingService.updateCallState(partnerId, callId, { state: 'ringing' });
    assert.equal(ringRes.callStatus, CallStatus.RINGING);

    // Recipient accepts and gets audio-only 300s token
    const respondRes = await callingService.respondToCall(partnerId, callId, {
      action: 'accept',
    });
    assert.equal(respondRes.callStatus, CallStatus.ACCEPTED);
    assert.ok(respondRes.token);

    const verifier = new TokenVerifier(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    );
    const receiverClaims = await verifier.verify(respondRes.token);
    assert.deepEqual(receiverClaims.video?.canPublishSources, ['microphone']);
    assert.equal(receiverClaims.video?.canPublishData, false);
    assert.equal(receiverClaims.video?.roomRecord, false);
    assert.equal(receiverClaims.video?.roomAdmin, false);

    // Caller now receives scoped token via /token
    const callerTokenRes = await callingService.issueJoinToken(testUserId, callId);
    assert.ok(callerTokenRes.token);
    assert.notEqual(callerTokenRes.participantIdentity, respondRes.participantIdentity);
    const callerClaims = await verifier.verify(callerTokenRes.token);
    assert.deepEqual(callerClaims.video?.canPublishSources, ['microphone']);

    // Connecting -> Active -> Reconnecting -> fresh reconnect token -> Active -> End
    await callingService.updateCallState(testUserId, callId, { state: 'connecting' });
    const activeDto = await callingService.updateCallState(testUserId, callId, { state: 'active' });
    assert.equal(activeDto.callStatus, CallStatus.ACTIVE);

    await callingService.updateCallState(testUserId, callId, { state: 'reconnecting' });
    const reissued = await callingService.issueJoinToken(partnerId, callId);
    assert.ok(reissued.token);
    await callingService.updateCallState(partnerId, callId, { state: 'active' });

    const endRes = await callingService.endCall(testUserId, callId);
    assert.equal(endRes.success, true);
    assert.equal(endRes.callStatus, CallStatus.ENDED);
    assert.ok(lk.evictedRooms.includes(inviteRes.callSession.livekitRoomId));

    // Post-end token reissue fails closed
    await assert.rejects(
      () => callingService.issueJoinToken(testUserId, callId),
      { name: 'ConflictException' },
    );
  });

  it('supports recipient decline and caller cancel, triggering room cleanup and terminal state', async () => {
    const lk = createTestLiveKitAdapter();
    const callingService = new CallingService(mockPrisma, cryptoService, undefined, lk.adapter);

    const invite1 = await callingService.inviteCall(testUserId, {
      conversationId: 'c3333333-3333-3333-3333-333333333333',
    });
    const declineRes = await callingService.respondToCall(partnerId, invite1.callSession.id, {
      action: 'decline',
    });
    assert.equal(declineRes.callStatus, CallStatus.REJECTED);
    assert.equal(declineRes.token, '');

    const invite2 = await callingService.inviteCall(testUserId, {
      conversationId: 'c4444444-4444-4444-4444-444444444444',
    });
    const cancelRes = await callingService.respondToCall(testUserId, invite2.callSession.id, {
      action: 'cancel',
    });
    assert.equal(cancelRes.callStatus, CallStatus.ENDED);
  });

  it('expires timed-out ring invitations cleanly and fails closed on LiveKit SFU outage', async () => {
    const lk = createTestLiveKitAdapter();
    const callingService = new CallingService(mockPrisma, cryptoService, undefined, lk.adapter);
    const convId = 'c5555555-5555-5555-5555-555555555555';

    const invite = await callingService.inviteCall(testUserId, { conversationId: convId });
    // Simulate invitation expiry in store
    const stored = (callingService as any).mockCallSessions.get(invite.callSession.id);
    stored.expiresAt = new Date(Date.now() - 1000);

    await assert.rejects(
      () => callingService.respondToCall(partnerId, invite.callSession.id, { action: 'accept' }),
      { name: 'ConflictException' },
    );
    assert.equal(stored.callStatus, CallStatus.MISSED);

    // Next invite on same conversation fails closed if LiveKit SFU is unavailable
    lk.setFailEnsure(true);
    await assert.rejects(
      () => callingService.inviteCall(testUserId, { conversationId: convId }),
      (err: unknown) => err instanceof CallingProviderUnavailableError,
    );
  });
});
