import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { CallingService } from '../src/modules/calling/calling.service';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { CallStatus } from '@saymyname/contracts';

describe('CallingService (Phase 4 Real-time calling & Voice Notes)', () => {
  const cryptoService = new CryptoService();
  const mockPrisma: any = {};
  const callingService = new CallingService(mockPrisma, cryptoService);

  const testUserId = 'a1111111-1111-1111-1111-111111111111';
  const partnerId = 'a2222222-2222-2222-2222-222222222222';
  const testConversationId = 'c1111111-1111-1111-1111-111111111111';

  it('presigns voice note within 60s limit with supported audio mime type', async () => {
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
    await assert.rejects(
      async () => {
        await callingService.presignVoiceNote(testUserId, {
          filename: 'long_ramble.mp3',
          mimeType: 'audio/mp3',
          durationSeconds: 61,
        });
      },
      {
        name: 'BadRequestException',
      },
    );
  });

  it('rejects voice note with unsupported mime type', async () => {
    await assert.rejects(
      async () => {
        await callingService.presignVoiceNote(testUserId, {
          filename: 'script.exe',
          mimeType: 'application/octet-stream',
          durationSeconds: 10,
        });
      },
      {
        name: 'BadRequestException',
      },
    );
  });

  it('initiates 1:1 call invitation with valid LiveKit room and JWT token', async () => {
    const inviteRes = await callingService.inviteCall(testUserId, {
      conversationId: testConversationId,
    });

    assert.ok(inviteRes.callSession.id);
    assert.equal(inviteRes.callSession.callStatus, CallStatus.INITIATED);
    assert.ok(inviteRes.callSession.livekitRoomId.startsWith('saymyname_call_'));
    assert.ok(inviteRes.token);
    assert.equal(inviteRes.token.split('.').length, 3); // Valid 3-part JWT
  });

  it('receiver accepts call and receives LiveKit token with accepted status', async () => {
    const inviteRes = await callingService.inviteCall(testUserId, {
      conversationId: testConversationId,
    });
    const callId = inviteRes.callSession.id;

    const respondRes = await callingService.respondToCall(partnerId, callId, {
      action: 'accept',
    });

    assert.equal(respondRes.callStatus, CallStatus.ACCEPTED);
    assert.ok(respondRes.token);
    assert.equal(respondRes.token.split('.').length, 3);

    const session = await callingService.getCallSession(testUserId, callId);
    assert.equal(session.callStatus, CallStatus.ACCEPTED);
    assert.ok(session.startedAt);
  });

  it('receiver declines call and marks session as rejected', async () => {
    const inviteRes = await callingService.inviteCall(testUserId, {
      conversationId: testConversationId,
    });
    const callId = inviteRes.callSession.id;

    const respondRes = await callingService.respondToCall(partnerId, callId, {
      action: 'decline',
    });

    assert.equal(respondRes.callStatus, CallStatus.REJECTED);
  });

  it('hangs up active call and calculates total duration', async () => {
    const inviteRes = await callingService.inviteCall(testUserId, {
      conversationId: testConversationId,
    });
    const callId = inviteRes.callSession.id;

    await callingService.respondToCall(partnerId, callId, { action: 'accept' });

    // Artificial short delay
    await new Promise((r) => setTimeout(r, 50));

    const endRes = await callingService.endCall(testUserId, callId);
    assert.equal(endRes.success, true);
    assert.equal(endRes.callStatus, CallStatus.ENDED);
    assert.ok(endRes.durationSeconds >= 0);
  });
});
