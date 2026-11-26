import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { TokenVerifier } from 'livekit-server-sdk';
import {
  assertCallStatusTransition,
  canTransitionCallStatus,
  isJoinableCallStatus,
  isNonTerminalCallStatus,
  isTerminalCallStatus,
} from '../src/modules/calling/calling-state-machine';
import {
  CallingProviderUnavailableError,
  LiveKitProviderAdapter,
  resolveLiveKitServiceHttpUrl,
} from '../src/modules/calling/livekit-provider.adapter';

describe('Phase 4.1 Calling Architecture, State Machine & LiveKit Provider Adapter', () => {
  it('enforces valid call lifecycle transitions and blocks post-terminal mutations', () => {
    assert.equal(canTransitionCallStatus('inviting', 'ringing'), true);
    assert.equal(canTransitionCallStatus('inviting', 'accepted'), true);
    assert.equal(canTransitionCallStatus('ringing', 'accepted'), true);
    assert.equal(canTransitionCallStatus('accepted', 'connecting'), true);
    assert.equal(canTransitionCallStatus('connecting', 'active'), true);
    assert.equal(canTransitionCallStatus('active', 'reconnecting'), true);
    assert.equal(canTransitionCallStatus('reconnecting', 'active'), true);
    assert.equal(canTransitionCallStatus('active', 'ended'), true);

    assert.equal(canTransitionCallStatus('ringing', 'active'), false);
    assert.equal(canTransitionCallStatus('ended', 'active'), false);
    assert.equal(canTransitionCallStatus('rejected', 'accepted'), false);
    assert.equal(canTransitionCallStatus('missed', 'accepted'), false);
    assert.equal(canTransitionCallStatus('failed', 'reconnecting'), false);

    assert.equal(isTerminalCallStatus('ended'), true);
    assert.equal(isTerminalCallStatus('rejected'), true);
    assert.equal(isNonTerminalCallStatus('inviting'), true);
    assert.equal(isNonTerminalCallStatus('reconnecting'), true);
    assert.equal(isJoinableCallStatus('inviting'), false);
    assert.equal(isJoinableCallStatus('ringing'), false);
    assert.equal(isJoinableCallStatus('accepted'), true);
    assert.equal(isJoinableCallStatus('reconnecting'), true);

    assert.throws(() => assertCallStatusTransition('ended', 'accepted'), {
      name: 'ConflictException',
    });
  });

  it('derives service HTTP URL cleanly from ws/wss LiveKit public URL', () => {
    delete process.env.LIVEKIT_SERVICE_URL;
    delete process.env.LIVEKIT_INTERNAL_URL;
    assert.equal(resolveLiveKitServiceHttpUrl('ws://127.0.0.1:7880'), 'http://127.0.0.1:7880');
    assert.equal(resolveLiveKitServiceHttpUrl('wss://lk.saymyname.in/'), 'https://lk.saymyname.in');
  });

  it('issues strictly audio-only, short-lived, pseudonymous LiveKit join tokens', async () => {
    const prevKey = process.env.LIVEKIT_API_KEY;
    const prevSecret = process.env.LIVEKIT_API_SECRET;
    const prevUrl = process.env.LIVEKIT_URL;
    const prevTtl = process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS;
    const prevEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'test';
      process.env.LIVEKIT_URL = 'ws://127.0.0.1:7880';
      process.env.LIVEKIT_API_KEY = 'APItestkey123';
      process.env.LIVEKIT_API_SECRET = '0123456789abcdef0123456789abcdef';
      process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS = '300';

      const adapter = new LiveKitProviderAdapter();
      const accountId = 'acc-secret-uuid-987654';
      const callSessionId = 'call-session-1111';
      const roomId = 'smn_call_room_1111';

      const issued = await adapter.issueAudioJoinToken({
        roomId,
        callSessionId,
        accountId,
      });

      assert.equal(issued.livekitUrl, 'ws://127.0.0.1:7880');
      assert.equal(issued.ttlSeconds, 300);
      assert.ok(issued.participantIdentity.startsWith('smn_p_'));
      assert.ok(!issued.participantIdentity.includes(accountId));
      assert.equal(
        adapter.buildParticipantIdentity(callSessionId, accountId),
        issued.participantIdentity,
      );

      const verifier = new TokenVerifier(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
      );
      const claims = await verifier.verify(issued.token);
      assert.equal(claims.sub, issued.participantIdentity);
      assert.equal(claims.name, 'Member');
      assert.equal(claims.video?.roomJoin, true);
      assert.equal(claims.video?.room, roomId);
      assert.equal(claims.video?.canPublish, true);
      assert.deepEqual(claims.video?.canPublishSources, ['microphone']);
      assert.equal(claims.video?.canSubscribe, true);
      assert.equal(claims.video?.canPublishData, false);
      assert.equal(claims.video?.canUpdateOwnMetadata, false);
      assert.equal(claims.video?.roomCreate, false);
      assert.equal(claims.video?.roomList, false);
      assert.equal(claims.video?.roomRecord, false);
      assert.equal(claims.video?.roomAdmin, false);

      const parts = issued.token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      assert.equal(payload.exp - payload.nbf, 300);
    } finally {
      process.env.LIVEKIT_API_KEY = prevKey;
      process.env.LIVEKIT_API_SECRET = prevSecret;
      process.env.LIVEKIT_URL = prevUrl;
      process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS = prevTtl;
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('fails closed in production if LiveKit credentials or wss transport are weak or missing', async () => {
    const prevKey = process.env.LIVEKIT_API_KEY;
    const prevSecret = process.env.LIVEKIT_API_SECRET;
    const prevUrl = process.env.LIVEKIT_URL;
    const prevEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';
      process.env.LIVEKIT_URL = 'ws://127.0.0.1:7880';
      process.env.LIVEKIT_API_KEY = 'devkey';
      process.env.LIVEKIT_API_SECRET = 'short';

      const adapter = new LiveKitProviderAdapter();
      assert.equal(adapter.isConfigured(), false);
      await assert.rejects(
        () =>
          adapter.issueAudioJoinToken({
            roomId: 'room1',
            callSessionId: 'call1',
            accountId: 'acc1',
          }),
        (err: unknown) => err instanceof CallingProviderUnavailableError,
      );
    } finally {
      process.env.LIVEKIT_API_KEY = prevKey;
      process.env.LIVEKIT_API_SECRET = prevSecret;
      process.env.LIVEKIT_URL = prevUrl;
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('calls RoomService Twirp endpoints cleanly for create, removeParticipant with revokeTokenTs, deleteRoom, 404 idempotency, and 503 outage normalization', async () => {
    const recordedPaths: string[] = [];
    const recordedBodies: Record<string, any> = {};
    let mode: 'ok' | 'not_found' | 'outage' = 'ok';

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const path = req.url || '';
        recordedPaths.push(path);
        const bodyText = Buffer.concat(chunks).toString('utf8');
        try {
          recordedBodies[path] = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          recordedBodies[path] = bodyText;
        }

        if (mode === 'outage') {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ code: 'unavailable', msg: 'sfu overloaded' }));
          return;
        }
        if (mode === 'not_found') {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ code: 'not_found', msg: 'requested participant does not exist' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        if (path.endsWith('/CreateRoom')) {
          res.end(JSON.stringify({ name: recordedBodies[path].name }));
        } else if (path.endsWith('/ListParticipants')) {
          res.end(JSON.stringify({ participants: [] }));
        } else {
          res.end(JSON.stringify({}));
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as { port: number };

    const prevKey = process.env.LIVEKIT_API_KEY;
    const prevSecret = process.env.LIVEKIT_API_SECRET;
    const prevUrl = process.env.LIVEKIT_URL;
    const prevServiceUrl = process.env.LIVEKIT_SERVICE_URL;
    const prevEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'test';
      process.env.LIVEKIT_URL = `ws://127.0.0.1:${addr.port}`;
      process.env.LIVEKIT_SERVICE_URL = `http://127.0.0.1:${addr.port}`;
      process.env.LIVEKIT_API_KEY = 'APItestkey123';
      process.env.LIVEKIT_API_SECRET = '0123456789abcdef0123456789abcdef';

      const adapter = new LiveKitProviderAdapter();
      await adapter.ensureAudioRoom({ roomId: 'smn_call_room_x' });
      assert.ok(recordedPaths.includes('/twirp/livekit.RoomService/CreateRoom'));
      assert.equal(recordedBodies['/twirp/livekit.RoomService/CreateRoom'].maxParticipants, 2);

      const evictRes = await adapter.evictSession({
        roomId: 'smn_call_room_x',
        callSessionId: 'call_x',
        participantAccountIds: ['acc_1', 'acc_2'],
        revokeTokenTs: 1700000123,
      });
      assert.equal(evictRes.outcome, 'evicted');
      assert.equal(evictRes.roomDeleted, 'deleted');
      assert.equal(evictRes.participantIdentities.length, 2);
      assert.ok(recordedPaths.includes('/twirp/livekit.RoomService/RemoveParticipant'));
      assert.ok(recordedPaths.includes('/twirp/livekit.RoomService/DeleteRoom'));
      assert.equal(
        String(recordedBodies['/twirp/livekit.RoomService/RemoveParticipant'].revokeTokenTs),
        '1700000123',
      );

      mode = 'not_found';
      const idempotentRes = await adapter.evictSession({
        roomId: 'smn_call_room_x',
        callSessionId: 'call_x',
        participantAccountIds: ['acc_1'],
      });
      assert.equal(idempotentRes.outcome, 'already_absent');
      assert.equal(idempotentRes.roomDeleted, 'already_absent');

      mode = 'outage';
      await assert.rejects(
        () => adapter.removeParticipant({ roomId: 'smn_call_room_x', callSessionId: 'call_x', accountId: 'acc_1' }),
        (err: unknown) => err instanceof CallingProviderUnavailableError,
      );
    } finally {
      process.env.LIVEKIT_API_KEY = prevKey;
      process.env.LIVEKIT_API_SECRET = prevSecret;
      process.env.LIVEKIT_URL = prevUrl;
      process.env.LIVEKIT_SERVICE_URL = prevServiceUrl;
      process.env.NODE_ENV = prevEnv;
      server.close();
    }
  });
});
