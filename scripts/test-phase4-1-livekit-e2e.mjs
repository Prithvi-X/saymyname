/**
 * Phase 4.1 Real End-to-End Integration Verification:
 * - Real Docker LiveKit SFU (`livekit/livekit-server:latest`)
 * - Real PostgreSQL (`saymyname_phase32_audit` with Phase 4.1 migration)
 * - Real Redis (`127.0.0.1:6379`)
 * - Live NestJS HTTP + WebSocket API (`AppModule`)
 * - Two Real Headless Microsoft Edge WebRTC peers (`livekit-client` UMD over CDP)
 *
 * Scenarios proven:
 * 1. Invite (zero token) -> Pre-accept /token denied (409) -> Accept (300s mic-only token) -> Caller /token -> 2-peer WebRTC audio active in LiveKit
 * 2. MATCH-22 Unmatch -> atomic DB closure + outbox call.evict -> real LiveKit kick + DeleteRoom + Edge disconnect + stale token denied
 * 3. MATCH-22 Block -> real LiveKit kick + DeleteRoom + Edge disconnect + stale token denied
 * 4. MATCH-22 Account Suspension -> real LiveKit kick + DeleteRoom + Edge disconnect + stale token denied
 * 5. MATCH-22 Verification Revocation -> real LiveKit kick + DeleteRoom + Edge disconnect + stale token denied
 * 6. Transient SFU Control-Plane Outage during Unmatch -> retries/backoff (`retrying`) -> SFU recovery completes eviction
 * 7. Concurrent `/token` reconnect vs `unmatch` race -> no stranded active room/participant
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { RoomServiceClient, TokenVerifier } = require('livekit-server-sdk');
const { ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { WsAdapter } = require('@nestjs/platform-ws');
const WebSocket = require('ws');

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const LK_API_KEY = 'APItestkey123';
const LK_API_SECRET = '0123456789abcdef0123456789abcdef';
const LK_WS_PORT = 7880;
const LK_WS_URL = `ws://127.0.0.1:${LK_WS_PORT}`;
const LK_HTTP_URL = `http://127.0.0.1:${LK_WS_PORT}`;
const API_PORT = 4014;
const HARNESS_PORT = 4015;
const EDGE_CDP_PORT = 9228;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const LK_CONTAINER = 'smn-lk-e2e-phase41';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `e4100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(age) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age, 0, 15));
}

async function waitUntil(fn, timeoutMs = 15000, label = 'condition') {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const val = await fn();
      if (val) return val;
    } catch (e) {
      lastErr = e;
    }
    await wait(150);
  }
  throw new Error(
    `Timed out waiting for ${label} (${timeoutMs}ms)${lastErr ? `: ${lastErr.message}` : ''}`,
  );
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.ws.on('message', (msg) => {
      const data = JSON.parse(String(msg));
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalAsync(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `CDP Runtime error: ${res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails)}`,
      );
    }
    return res.result?.value;
  }
  async close() {
    this.ws.close();
  }
}

function startHarnessServer() {
  const lkJs = fs.readFileSync(
    path.resolve('node_modules/livekit-client/dist/livekit-client.umd.js'),
  );
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>LiveKit E2E Audio Peer</title></head>
<body>
<script src="/livekit-client.umd.js"></script>
<script>
window.__smnPeer = {
  room: null,
  events: [],
  disconnectReason: null,
  async join(url, token) {
    if (this.room) {
      try { await this.room.disconnect(); } catch {}
    }
    this.events = [];
    this.disconnectReason = null;
    const LK = window.LivekitClient;
    const room = new LK.Room({ adaptiveStream: false, dynacast: false });
    this.room = room;
    room.on(LK.RoomEvent.Connected, () => this.events.push('connected'));
    room.on(LK.RoomEvent.Disconnected, (reason) => {
      this.disconnectReason = String(reason ?? 'disconnected');
      this.events.push('disconnected:' + this.disconnectReason);
    });
    await room.connect(url, token, { autoSubscribe: true });
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      this.events.push('mic_published');
    } catch (e) {
      this.events.push('mic_err:' + (e && e.message ? e.message : String(e)));
    }
    return {
      state: room.state,
      identity: room.localParticipant.identity,
      events: this.events.slice(),
    };
  },
  status() {
    return {
      state: this.room ? this.room.state : 'none',
      disconnectReason: this.disconnectReason,
      events: this.events.slice(),
    };
  },
  async leave() {
    if (this.room) {
      await this.room.disconnect();
    }
  }
};
</script>
</body>
</html>`;

  const server = http.createServer((req, res) => {
    if (req.url === '/livekit-client.umd.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(lkJs);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  return new Promise((resolve) => {
    server.listen(HARNESS_PORT, '127.0.0.1', () => resolve(server));
  });
}

function startDockerLiveKit() {
  try {
    execFileSync('docker', ['rm', '-f', LK_CONTAINER], { stdio: 'ignore' });
  } catch {}
  const livekitYaml = [
    `port: ${LK_WS_PORT}`,
    'rtc:',
    '  tcp_port: 7881',
    '  udp_port: 7882',
    '  node_ip: 127.0.0.1',
    '  use_external_ip: false',
    'room:',
    '  auto_create: false',
    'keys:',
    `  ${LK_API_KEY}: ${LK_API_SECRET}`,
    'logging:',
    '  level: warn',
  ].join('\n');

  execFileSync(
    'docker',
    [
      'run',
      '-d',
      '--name',
      LK_CONTAINER,
      '-p',
      `${LK_WS_PORT}:7880`,
      '-p',
      '7881:7881',
      '-p',
      '7882:7882/udp',
      '-e',
      `LIVEKIT_CONFIG=${livekitYaml}`,
      'livekit/livekit-server:latest',
      '--bind',
      '0.0.0.0',
    ],
    { stdio: 'pipe' },
  );
}

function stopDockerLiveKit() {
  try {
    execFileSync('docker', ['rm', '-f', LK_CONTAINER], { stdio: 'ignore' });
  } catch {}
}

async function main() {
  // Set required runtime environment BEFORE importing compiled AppModule
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = DB_URL;
  process.env.REDIS_URL = REDIS_URL;
  process.env.DISABLE_REDIS = 'false';
  process.env.DISABLE_OUTBOX_WORKER = 'true';
  process.env.DISABLE_CALL_EVICTION_WORKER = 'false';
  process.env.CALL_EVICTION_POLL_INTERVAL_MS = '250';
  process.env.CALL_EVICTION_RETRY_BASE_MS = '150';
  process.env.CALL_EVICTION_RETRY_MAX_MS = '400';
  process.env.CALL_RECONCILE_INTERVAL_MS = '10000';
  process.env.JWT_ACCESS_SECRET = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
  process.env.JWT_REFRESH_SECRET = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
  process.env.LIVEKIT_URL = LK_WS_URL;
  process.env.LIVEKIT_SERVICE_URL = LK_HTTP_URL;
  process.env.LIVEKIT_API_KEY = LK_API_KEY;
  process.env.LIVEKIT_API_SECRET = LK_API_SECRET;
  process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS = '300';
  process.env.CALL_INVITE_TTL_SECONDS = '45';
  process.env.REVIEWER_API_KEY = 'e2e-reviewer-audit-key';

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  await prisma.$connect();

  let harnessServer;
  let nestApp;
  let edgeProc;
  const edgeUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-lk-'));

  try {
    console.log('1. Starting ephemeral local LiveKit Docker SFU...');
    startDockerLiveKit();
    await waitUntil(async () => {
      const r = await fetch(LK_HTTP_URL);
      return r.status < 500;
    }, 15000, 'LiveKit HTTP ready');

    const roomService = new RoomServiceClient(LK_HTTP_URL, LK_API_KEY, LK_API_SECRET);
    const tokenVerifier = new TokenVerifier(LK_API_KEY, LK_API_SECRET);

    console.log('2. Seeding verified IITM users and resetting calling outbox rows...');
    const slugs = [
      ['lk_caller', 'Aarav', 1],
      ['lk_peer_unmatch', 'Riya', 2],
      ['lk_peer_block', 'Meera', 3],
      ['lk_peer_suspend', 'Kabir', 4],
      ['lk_peer_verify', 'Ananya', 5],
      ['lk_peer_outage', 'Vikram', 6],
      ['lk_peer_race', 'Nisha', 7],
    ];
    const users = {};
    const passwordHash = hashPasswordPbkdf2('AuditPassword123!');

    // Clear disposable audit tables safely before seeding Phase 4.1 E2E members
    await prisma.outboxEvent.deleteMany();
    await prisma.callSession.deleteMany();
    await prisma.messageMedia.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversationMember.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.matchStateEvent.deleteMany();
    await prisma.gameSessionMember.deleteMany();
    await prisma.gameSession.deleteMany();
    await prisma.virtualDate.deleteMany();
    await prisma.relationshipMilestone.deleteMany();
    await prisma.relationshipJournal.deleteMany();
    await prisma.relationshipSpace.deleteMany();
    await prisma.match.deleteMany();
    await prisma.like.deleteMany();
    await prisma.pass.deleteMany();
    await prisma.userBlock.deleteMany();
    await prisma.report.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.verificationEvidenceRef.deleteMany();
    await prisma.verificationCase.deleteMany();
    await prisma.profilePhoto.deleteMany();
    await prisma.preferenceSetting.deleteMany();
    await prisma.profilePromptAnswer.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.accountEligibility.deleteMany();
    await prisma.appSession.deleteMany();
    await prisma.account.deleteMany();

    for (const [slug, name, idx] of slugs) {
      const accountId = makeUuid(idx);
      const email = `${slug}@ds.study.iitm.ac.in`;
      await prisma.account.create({
        data: {
          id: accountId,
          authSubject: `sub-lk41-${slug}`,
          email,
          passwordHash,
          emailVerifiedAt: new Date(),
          accountStatus: 'active',
          displayName: name,
        },
      });
      await prisma.accountEligibility.create({
        data: {
          accountId,
          ageStatus: 'approved',
          studentStatus: 'approved',
          programmeFamily: 'data_science_applications',
          pathwayCode: 'diploma',
          dateOfBirth: makeDobForAge(22),
          discoveryEligible: true,
          ageVerifiedAt: new Date(),
          studentVerifiedAt: new Date(),
          verifiedAt: new Date(),
          verifiedBy: 'manual_review',
          validUntil: new Date(Date.now() + 90 * 86400 * 1000),
        },
      });
      const profile = await prisma.profile.create({
        data: {
          id: makeUuid(100 + idx),
          accountId,
          displayName: name,
          programmeFamily: 'data_science_applications',
          termOrYear: 'Diploma Level',
          locationCity: 'Chennai',
          locationState: 'Tamil Nadu',
          intention: 'serious_relationship',
          bio: `${name} Phase 4.1 LiveKit E2E test member.`,
          ageDisplayMode: 'show_calculated_age',
          profileStatus: 'live',
          isPublished: true,
          isPaused: false,
          publishedAt: new Date(),
          consentAcceptedAt: new Date(),
        },
      });
      await prisma.preferenceSetting.create({
        data: {
          profileId: profile.id,
          minAge: 18,
          maxAge: 35,
          allowedProgrammes: [
            'data_science_applications',
            'electronic_systems',
            'aeronautics_space',
            'management_data_science',
          ],
          maxDistanceKm: 15,
          showInDiscovery: true,
        },
      });
      await prisma.profilePhoto.create({
        data: {
          profileId: profile.id,
          s3Key: `profiles/${accountId}/primary.jpg`,
          mimeType: 'image/jpeg',
          isPrimary: true,
          displayOrder: 0,
        },
      });
      users[slug] = { accountId, email, profileId: profile.id, name };
    }

    console.log('3. Booting live NestJS AppModule + Harness HTTP server + Headless Edge...');
    const { AppModule } = require('../services/api/dist/src/app.module');
    const { IdentityService } = require('../services/api/dist/src/modules/identity/identity.service');
    const { VerificationService } = require('../services/api/dist/src/modules/verification/verification.service');
    const { CallEvictionRelayService } = require('../services/api/dist/src/modules/calling/call-eviction-relay.service');

    nestApp = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useWebSocketAdapter(new WsAdapter(nestApp));
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await nestApp.listen(API_PORT, '127.0.0.1');

    const identityService = nestApp.get(IdentityService);
    const verificationService = nestApp.get(VerificationService);
    const evictionRelay = nestApp.get(CallEvictionRelayService);

    harnessServer = await startHarnessServer();

    edgeProc = spawn(
      EDGE_PATH,
      [
        `--remote-debugging-port=${EDGE_CDP_PORT}`,
        `--user-data-dir=${edgeUserData}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `http://127.0.0.1:${HARNESS_PORT}/peer1`,
      ],
      { stdio: 'ignore' },
    );

    await waitUntil(async () => {
      const r = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/list`);
      const targets = await r.json();
      return Array.isArray(targets) && targets.some((t) => t.type === 'page');
    }, 15000, 'Edge CDP ready');

    // Open a second target tab in Edge for Peer 2
    await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/new?http://127.0.0.1:${HARNESS_PORT}/peer2`, {
      method: 'PUT',
    });
    const targets = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/list`).then((r) => r.json());
    const pages = targets.filter((t) => t.type === 'page');
    assert.ok(pages.length >= 2, 'Expected 2 Edge page tabs');

    const cdpCaller = new CDPClient(pages[0].webSocketDebuggerUrl);
    const cdpPeer = new CDPClient(pages[1].webSocketDebuggerUrl);
    await Promise.all([cdpCaller.connect(), cdpPeer.connect()]);
    await Promise.all([
      cdpCaller.send('Page.enable'),
      cdpCaller.send('Runtime.enable'),
      cdpPeer.send('Page.enable'),
      cdpPeer.send('Runtime.enable'),
    ]);

    const baseApi = `http://127.0.0.1:${API_PORT}/api/v1`;
    const login = async (email) => {
      const r = await fetch(`${baseApi}/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'AuditPassword123!' }),
      });
      assert.equal(r.status, 200, `Login failed for ${email}`);
      return (await r.json()).accessToken;
    };

    const callerToken = await login(users.lk_caller.email);

    async function formMatchAndActiveEdgeCall(peerUser) {
      const peerToken = await login(peerUser.email);
      await fetch(`${baseApi}/dating/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
        body: JSON.stringify({ targetProfileId: peerUser.profileId }),
      });
      const matchRes = await fetch(`${baseApi}/dating/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peerToken}` },
        body: JSON.stringify({ targetProfileId: users.lk_caller.profileId }),
      }).then((r) => r.json());
      assert.equal(matchRes.isMutualMatch, true, 'Match formation failed');

      const inviteRes = await fetch(`${baseApi}/calling/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
        body: JSON.stringify({ conversationId: matchRes.conversationId }),
      }).then((r) => r.json());
      assert.ok(inviteRes.callSession?.id, 'Invite must create callSession');
      assert.equal('token' in inviteRes, false, 'Invite must NOT expose LiveKit join token before acceptance');

      // Pre-accept token fetch MUST fail 409
      const preTokenRes = await fetch(`${baseApi}/calling/${inviteRes.callSession.id}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
      });
      assert.equal(preTokenRes.status, 409, 'Caller pre-accept token must fail 409');

      // Peer accepts -> gets scoped 300s audio-only LiveKit token
      const acceptRes = await fetch(`${baseApi}/calling/${inviteRes.callSession.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peerToken}` },
        body: JSON.stringify({ action: 'accept' }),
      }).then((r) => r.json());
      assert.ok(acceptRes.token, 'Accept must issue LiveKit join token');
      const peerClaims = await tokenVerifier.verify(acceptRes.token);
      assert.deepEqual(peerClaims.video?.canPublishSources, ['microphone']);
      assert.equal(peerClaims.video?.canPublishData, false);
      assert.equal(peerClaims.video?.roomRecord, false);

      // Caller requests scoped post-accept token
      const callerJoin = await fetch(`${baseApi}/calling/${inviteRes.callSession.id}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
      }).then((r) => r.json());
      assert.ok(callerJoin.token);

      // Both Edge WebRTC tabs actually join the real LiveKit Docker room
      await Promise.all([
        cdpCaller.evalAsync(`window.__smnPeer.join(${JSON.stringify(callerJoin.livekitUrl)}, ${JSON.stringify(callerJoin.token)})`),
        cdpPeer.evalAsync(`window.__smnPeer.join(${JSON.stringify(acceptRes.livekitUrl)}, ${JSON.stringify(acceptRes.token)})`),
      ]);

      await fetch(`${baseApi}/calling/${inviteRes.callSession.id}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
        body: JSON.stringify({ state: 'active' }),
      });

      const participants = await waitUntil(async () => {
        const list = await roomService.listParticipants(inviteRes.callSession.livekitRoomId);
        return list.length === 2 ? list : null;
      }, 10000, '2 real Edge WebRTC participants in LiveKit room');

      for (const p of participants) {
        assert.ok(p.identity.startsWith('smn_p_'), `Identity must be pseudonymous: ${p.identity}`);
        assert.ok(!p.identity.includes(users.lk_caller.accountId));
        assert.ok(!p.identity.includes(peerUser.accountId));
      }

      return {
        matchId: matchRes.matchId,
        conversationId: matchRes.conversationId,
        callSessionId: inviteRes.callSession.id,
        roomId: inviteRes.callSession.livekitRoomId,
        callerLkToken: callerJoin.token,
        peerLkToken: acceptRes.token,
        peerToken,
      };
    }

    async function assertEvictedFromRealSfu(ctx, label) {
      await waitUntil(async () => {
        const [s1, s2, parts] = await Promise.all([
          cdpCaller.evalAsync(`window.__smnPeer.status()`),
          cdpPeer.evalAsync(`window.__smnPeer.status()`),
          roomService.listParticipants(ctx.roomId).catch(() => []),
        ]);
        const cs = await prisma.callSession.findUnique({ where: { id: ctx.callSessionId } });
        return (
          s1.state === 'disconnected' &&
          s2.state === 'disconnected' &&
          parts.length === 0 &&
          cs?.evictionStatus === 'completed'
        );
      }, 10000, `${label}: Edge peers disconnected, SFU empty, DB eviction completed`);

      // Token endpoint MUST now return 403
      const afterToken = await fetch(`${baseApi}/calling/${ctx.callSessionId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
      });
      assert.equal(afterToken.status, 403, `${label}: post-revocation /token must return 403`);

      // Reusing previously-issued LiveKit JWT on real SFU? Wait: LiveKit DeleteRoom deletes room + RemoveParticipant revokeTokenTs sets revocation cutoff
      // Confirm caller cannot rejoin the deleted room with old JWT when no room exists / token revoked
      await cdpCaller.evalAsync(`
        (async () => {
          try {
            await window.__smnPeer.join(${JSON.stringify(LK_WS_URL)}, ${JSON.stringify(ctx.callerLkToken)});
            window.__rejoinOk = true;
          } catch (e) {
            window.__rejoinOk = false;
          }
        })()
      `);
      const rejoinOk = await cdpCaller.evalAsync(`window.__rejoinOk`);
      // Because grants allow roomJoin ONLY (roomCreate: false!) and DeleteRoom removed the room on SFU, rejoin MUST FAIL!
      assert.equal(rejoinOk, false, `${label}: stale LiveKit JWT MUST NOT rejoin after DeleteRoom!`);
    }

    console.log('4. [MATCH-22 Scenario 1] Unmatch during active 2-peer Edge call...');
    const s1 = await formMatchAndActiveEdgeCall(users.lk_peer_unmatch);
    const unmatchRes = await fetch(`${baseApi}/dating/matches/${s1.matchId}/unmatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
      body: JSON.stringify({ reason: 'E2E unmatch' }),
    });
    assert.ok(unmatchRes.status === 200 || unmatchRes.status === 201);
    await assertEvictedFromRealSfu(s1, 'Unmatch');
    console.log('   PASS: Both Edge clients kicked cleanly, room deleted, stale JWT rejected.');

    console.log('5. [MATCH-22 Scenario 2] Block during active 2-peer Edge call...');
    const s2 = await formMatchAndActiveEdgeCall(users.lk_peer_block);
    const blockRes = await fetch(`${baseApi}/safety/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
      body: JSON.stringify({ targetProfileId: users.lk_peer_block.profileId, reason: 'E2E block' }),
    });
    assert.ok(blockRes.status === 200 || blockRes.status === 201);
    await assertEvictedFromRealSfu(s2, 'Block');
    console.log('   PASS: Block evicted both peers from LiveKit SFU & deleted room.');

    console.log('6. [MATCH-22 Scenario 3] Account Suspension during active 2-peer Edge call...');
    const s3 = await formMatchAndActiveEdgeCall(users.lk_peer_suspend);
    await identityService.suspendOrRestrictAccount(users.lk_peer_suspend.accountId, {
      status: 'suspended',
    });
    await assertEvictedFromRealSfu(s3, 'Account Suspension');
    console.log('   PASS: Account suspension evicted both peers from LiveKit SFU.');

    console.log('7. [MATCH-22 Scenario 4] Verification Revocation during active 2-peer Edge call...');
    const s4 = await formMatchAndActiveEdgeCall(users.lk_peer_verify);
    const vCase = await prisma.verificationCase.create({
      data: {
        accountId: users.lk_peer_verify.accountId,
        checkType: 'student_enrolment',
        providerCode: 'manual_audit',
        status: 'approved',
      },
    });
    await verificationService.decideCase('e2e-reviewer', vCase.id, {
      decision: 'rejected',
      reasonCode: 'revoked_e2e',
      rejectionReason: 'Verification revoked in E2E test',
    });
    await assertEvictedFromRealSfu(s4, 'Verification Revocation');
    console.log('   PASS: Verification revocation evicted both peers from LiveKit SFU.');

    console.log('8. [MATCH-22 Scenario 5] Transient SFU outage during Unmatch -> Retrying -> Recovery...');
    const s5 = await formMatchAndActiveEdgeCall(users.lk_peer_outage);
    // Simulate SFU control-plane outage by pointing service URL to closed port
    process.env.LIVEKIT_SERVICE_URL = 'http://127.0.0.1:59999';
    await fetch(`${baseApi}/dating/matches/${s5.matchId}/unmatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
      body: JSON.stringify({ reason: 'Outage test' }),
    });
    await waitUntil(async () => {
      const cs = await prisma.callSession.findUnique({ where: { id: s5.callSessionId } });
      return cs?.callStatus === 'ended' && cs?.evictionStatus === 'retrying' && cs?.evictionAttempts >= 1;
    }, 6000, 'Outage leaves CallSession ended + evictionStatus retrying');
    // Restore real SFU control-plane URL and verify automatic recovery kicks both Edge peers!
    process.env.LIVEKIT_SERVICE_URL = LK_HTTP_URL;
    await evictionRelay.runReconciliationSweep().catch(() => null);
    await wait(250);
    await evictionRelay.triggerImmediateFlush().catch(() => null);
    await assertEvictedFromRealSfu(s5, 'Outage Recovery');
    console.log('   PASS: Outage preserved durable call.evict job & recovery kicked both Edge peers.');

    console.log('9. [MATCH-22 Scenario 6] Concurrent /token reconnect vs unmatch race...');
    const s6 = await formMatchAndActiveEdgeCall(users.lk_peer_race);
    await Promise.all([
      fetch(`${baseApi}/calling/${s6.callSessionId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s6.peerToken}` },
      }),
      fetch(`${baseApi}/dating/matches/${s6.matchId}/unmatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${callerToken}` },
        body: JSON.stringify({ reason: 'Race test' }),
      }),
    ]);
    await assertEvictedFromRealSfu(s6, 'Concurrent Race');
    console.log('   PASS: Concurrent reconnect vs unmatch leaves 0 LiveKit participants & closed session.');

    await Promise.all([cdpCaller.close(), cdpPeer.close()]);
    console.log('\nALL PHASE 4.1 REAL LIVEKIT + POSTGRES + REDIS + EDGE WEBRTC E2E SCENARIOS PASSED!');
  } finally {
    if (edgeProc) {
      try {
        edgeProc.kill('SIGKILL');
      } catch {}
    }
    if (nestApp) {
      await nestApp.close().catch(() => null);
    }
    if (harnessServer) {
      harnessServer.close();
    }
    stopDockerLiveKit();
    await prisma.$disconnect();
    try {
      fs.rmSync(edgeUserData, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('\nPHASE 4.1 LIVEKIT E2E FAILED:', err);
  process.exit(1);
});
