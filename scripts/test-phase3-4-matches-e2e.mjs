/**
 * Phase 3.4 Real End-to-End Integration Verification: Matches & Connection Management
 * Exercises: Local S3 Storage + Real PostgreSQL (saymyname_phase32_audit) +
 * Real NestJS API (:4003) + Real Next.js BFF Server (:3007) + Real Microsoft Edge Browser.
 *
 * Covers:
 * - Concurrent Unmatch vs Unmatch (zero duplicate MatchStateEvent)
 * - Concurrent Unmatch vs Messaging / Calling / Games races
 * - Post-unmatch access denial (HTTP 403 across Matches, Messaging, Calling, Together & stale Likes non-reactivation)
 * - Full /matches -> /chats conversation opening, sending messages, browser back / ended-chat guard
 * - Explicit Unmatch confirmation (Cancel -> preserves match; Confirm -> ends without creating Block/Report)
 * - Separate Report (without automatic block) & separate Block flows
 * - Empty states (initial vs connection-ended), hidden-age privacy, responsive viewports & zero JS exceptions.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const sharpModule = require('sharp');
const sharp = sharpModule.default || sharpModule;

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const API_PORT = 4003;
const WEB_PORT = 3007;
const S3_PORT = 9011;
const S3_BUCKET = 'saymyname-local';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const QA_JWT_ACCESS = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
const QA_JWT_REFRESH = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
const SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase3_4';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `f3400000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(age) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age, 0, 15));
}

async function generatePortraitJpeg(colorHex, label) {
  const svg = `<svg width="480" height="580" xmlns="http://www.w3.org/2000/svg">
    <rect width="480" height="580" fill="#0B0D10"/>
    <rect x="40" y="40" width="400" height="500" fill="#12161B" stroke="#343D48" stroke-width="2"/>
    <rect x="140" y="140" width="200" height="240" fill="${colorHex}" opacity="0.88"/>
    <text x="240" y="460" font-family="sans-serif" font-size="18" fill="#F0F1EE" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

function startLocalS3Server() {
  const objects = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${S3_PORT}`);
    const prefix = `/${S3_BUCKET}/`;
    const key = url.pathname.startsWith(prefix)
      ? decodeURIComponent(url.pathname.slice(prefix.length))
      : decodeURIComponent(url.pathname.slice(1));

    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const body = Buffer.concat(chunks);

    if (req.method === 'PUT') {
      objects.set(key, {
        body,
        contentType: req.headers['content-type'] || 'application/octet-stream',
      });
      res.writeHead(200, { ETag: '"local-etag"' });
      return res.end();
    }
    if (req.method === 'HEAD') {
      const item = objects.get(key);
      if (!item) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        'Content-Length': String(item.body.length),
        'Content-Type': item.contentType,
      });
      return res.end();
    }
    if (req.method === 'GET') {
      const item = objects.get(key);
      if (!item) {
        res.writeHead(404);
        return res.end('NoSuchKey');
      }
      res.writeHead(200, {
        'Content-Type': item.contentType,
        'Content-Length': String(item.body.length),
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      return res.end(item.body);
    }
    if (req.method === 'DELETE') {
      objects.delete(key);
      res.writeHead(204);
      return res.end();
    }
    res.writeHead(405);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(S3_PORT, '127.0.0.1', () => resolve({ server, objects }));
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method) {
        this.events.push(data);
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
  async close() {
    this.ws.close();
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await wait(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function run() {
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const { server: s3Server } = await startLocalS3Server();

  const sharedEnv = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: DB_URL,
    JWT_ACCESS_SECRET: QA_JWT_ACCESS,
    JWT_REFRESH_SECRET: QA_JWT_REFRESH,
    API_BACKEND_URL: `http://127.0.0.1:${API_PORT}`,
    WEB_APP_URL: `http://127.0.0.1:${WEB_PORT}`,
    R2_ENDPOINT: `http://127.0.0.1:${S3_PORT}`,
    R2_FORCE_PATH_STYLE: 'true',
    R2_BUCKET_NAME: S3_BUCKET,
    R2_ACCESS_KEY_ID: 'localqa',
    R2_SECRET_ACCESS_KEY: 'localqa',
    PORT: String(API_PORT),
  };

  let apiProc;
  let webProc;
  let edgeProc;
  let cdp;

  try {
    console.log('1. Resetting & seeding disposable PostgreSQL schema for Phase 3.4 Matches...');
    await prisma.message.deleteMany();
    await prisma.conversationMember.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.matchStateEvent.deleteMany();
    await prisma.callSession.deleteMany();
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
    await prisma.profilePhoto.deleteMany();
    await prisma.preferenceSetting.deleteMany();
    await prisma.profilePromptAnswer.deleteMany();
    await prisma.profileInterest.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.appSession.deleteMany();
    await prisma.accountEligibility.deleteMany();
    await prisma.account.deleteMany();

    const passwordHash = hashPasswordPbkdf2('AuditPassword123!');

    const seedMember = async (opts) => {
      const account = await prisma.account.create({
        data: {
          id: makeUuid(opts.num),
          authSubject: `sub-m34-${opts.slug}`,
          email: `${opts.slug}@ds.study.iitm.ac.in`,
          passwordHash,
          emailVerifiedAt: new Date(),
          accountStatus: opts.accountStatus ?? 'active',
          displayName: opts.displayName,
        },
      });
      await prisma.accountEligibility.create({
        data: {
          accountId: account.id,
          ageStatus: 'approved',
          studentStatus: 'approved',
          programmeFamily: opts.programme ?? 'data_science_applications',
          pathwayCode: 'diploma',
          dateOfBirth: makeDobForAge(opts.age ?? 22),
          discoveryEligible: true,
          ageVerifiedAt: new Date(),
          studentVerifiedAt: new Date(),
          verifiedAt: new Date(),
          verifiedBy: 'manual_review',
        },
      });
      const profile = await prisma.profile.create({
        data: {
          id: makeUuid(500 + opts.num),
          accountId: account.id,
          displayName: opts.displayName,
          bio: opts.bio ?? `Verified peer bio for ${opts.displayName}. Built with mutual consent and calm pacing.`,
          programmeFamily: opts.programme ?? 'data_science_applications',
          termOrYear: opts.term ?? 'Diploma Level',
          locationCity: opts.city ?? 'Chennai',
          locationState: 'Tamil Nadu',
          intention: 'serious_relationship',
          profileStatus: 'live',
          ageDisplayMode: opts.ageDisplayMode ?? 'show_calculated_age',
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
      return { account, profile };
    };

    const viewer = await seedMember({ num: 1, slug: 'viewer', displayName: 'Ananya Reviewer', age: 23 });
    const kavya = await seedMember({ num: 2, slug: 'kavya', displayName: 'Kavya Nair', age: 23, programme: 'electronic_systems', city: 'Bengaluru' });
    const arjunHidden = await seedMember({ num: 3, slug: 'arjun', displayName: 'Arjun PrivateAge', age: 25, ageDisplayMode: 'hidden', programme: 'aeronautics_space', city: 'Hyderabad' });
    const rohan = await seedMember({ num: 4, slug: 'rohan', displayName: 'Rohan Mehta', age: 24, programme: 'management_data_science', city: 'Pune' });
    const racePeer = await seedMember({ num: 5, slug: 'racepeer', displayName: 'Siddharth Concurrency', age: 24, programme: 'data_science_applications' });
    const suspPeer = await seedMember({ num: 6, slug: 'suspended', displayName: 'SuspendedMatch', age: 22, accountStatus: 'suspended' });

    console.log('2. Starting real NestJS API (:4003) & real built Next.js BFF (:3007)...');
    apiProc = spawn(process.execPath, ['services/api/dist/src/main.js'], {
      cwd: 'i:\\saymyname',
      env: sharedEnv,
      stdio: 'pipe',
    });
    apiProc.stderr.on('data', (d) => process.stderr.write(`[API] ${d}`));

    webProc = spawn(
      process.execPath,
      ['i:\\saymyname\\node_modules\\next\\dist\\bin\\next', 'start', '-p', String(WEB_PORT)],
      { cwd: 'i:\\saymyname\\apps\\web', env: { ...sharedEnv, NODE_ENV: 'production' }, stdio: 'pipe' },
    );
    webProc.stderr.on('data', (d) => process.stderr.write(`[WEB] ${d}`));

    await waitForHttp(`http://127.0.0.1:${API_PORT}/api/v1/health`);
    await waitForHttp(`http://127.0.0.1:${WEB_PORT}/login`);

    const loginApi = async (slug) => {
      const r = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${slug}@ds.study.iitm.ac.in`, password: 'AuditPassword123!' }),
      });
      assert.equal(r.status, 200, `API login failed for ${slug}`);
      return r.json();
    };

    const uploadPhoto = async (slug, colorHex, label) => {
      const auth = await loginApi(slug);
      const jpeg = await generatePortraitJpeg(colorHex, label);
      const presign = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/profiles/me/photos/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ filename: `${slug}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: jpeg.length }),
      });
      assert.ok(presign.status === 200 || presign.status === 201);
      const { uploadUrl, s3Key } = await presign.json();
      await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg });
      const attach = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ s3Key, mimeType: 'image/jpeg', isPrimary: true, fileSizeBytes: jpeg.length }),
      });
      assert.ok(attach.status === 200 || attach.status === 201);
    };

    for (const [slug, hex, lbl] of [
      ['viewer', '#8580C4', 'ANANYA'],
      ['kavya', '#E18A62', 'KAVYA'],
      ['arjun', '#8580C4', 'ARJUN'],
      ['rohan', '#77C5A1', 'ROHAN'],
      ['racepeer', '#E6BC69', 'RACE'],
    ]) {
      await uploadPhoto(slug, hex, lbl);
    }

    const viewerApiAuth = await loginApi('viewer');
    const kavyaApiAuth = await loginApi('kavya');
    const raceApiAuth = await loginApi('racepeer');

    const formMatchViaLikes = async (peerAuth, peerObj) => {
      const r1 = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerApiAuth.accessToken}` },
        body: JSON.stringify({ targetProfileId: peerObj.profile.id }),
      }).then((r) => r.json());
      assert.equal(r1.isMutualMatch, false);
      const r2 = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peerAuth.accessToken}` },
        body: JSON.stringify({ targetProfileId: viewer.profile.id }),
      }).then((r) => r.json());
      assert.equal(r2.isMutualMatch, true);
      return r2;
    };

    console.log('3. Testing Real PostgreSQL Unmatch Concurrency (Double-Unmatch & Message/Call/Game Races)...');
    const raceMatch = await formMatchViaLikes(raceApiAuth, racePeer);

    const [unm1, unm2, raceMsg, raceCall, raceGame] = await Promise.all([
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/matches/${raceMatch.matchId}/unmatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerApiAuth.accessToken}` },
        body: JSON.stringify({ reason: 'Concurrent test A' }),
      }).then(async (r) => ({ status: r.status, body: await r.json() })),
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/matches/${raceMatch.matchId}/unmatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceApiAuth.accessToken}` },
        body: JSON.stringify({ reason: 'Concurrent test B' }),
      }).then(async (r) => ({ status: r.status, body: await r.json() })),
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/messaging/conversations/${raceMatch.conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceApiAuth.accessToken}` },
        body: JSON.stringify({ bodyText: 'Racing message' }),
      }).then((r) => r.status),
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/calling/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceApiAuth.accessToken}` },
        body: JSON.stringify({ conversationId: raceMatch.conversationId }),
      }).then((r) => r.status),
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/together/games/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceApiAuth.accessToken}` },
        body: JSON.stringify({ conversationId: raceMatch.conversationId, gameKey: 'word_scramble' }),
      }).then((r) => r.status),
    ]);

    assert.ok([200, 201].includes(unm1.status) && [200, 201].includes(unm2.status));
    assert.notEqual(
      unm1.body.alreadyEnded,
      unm2.body.alreadyEnded,
      'Exactly one concurrent unmatch wins and the second observes alreadyEnded=true',
    );
    const raceEvents = await prisma.matchStateEvent.findMany({ where: { matchId: raceMatch.matchId } });
    assert.equal(raceEvents.length, 1, 'PostgreSQL FOR UPDATE lock must emit strictly 1 MatchStateEvent on concurrent unmatch');
    assert.ok([200, 201, 403].includes(raceMsg) && [200, 201, 403].includes(raceCall) && [200, 201, 403].includes(raceGame));

    // After unmatch commits, all subsequent operations MUST deny 403 and any earlier sessions remain closed
    const openCallsAfter = await prisma.callSession.findMany({
      where: { conversationId: raceMatch.conversationId, callStatus: { in: ['initiated', 'ringing', 'accepted', 'active'] } },
    });
    assert.equal(openCallsAfter.length, 0, 'No CallSession may remain open after unmatch race settles');
    const postRaceSend = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/messaging/conversations/${raceMatch.conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceApiAuth.accessToken}` },
      body: JSON.stringify({ bodyText: 'Should reject after unmatch' }),
    });
    assert.equal(postRaceSend.status, 403);

    // Seed 3 active matches for UI journey + 1 active match with suspended peer (must stay excluded)
    const arjunAuth = await loginApi('arjun');
    const rohanAuth = await loginApi('rohan');
    const kavyaMatch = await formMatchViaLikes(kavyaApiAuth, kavya);
    const arjunMatch = await formMatchViaLikes(arjunAuth, arjunHidden);
    const rohanMatch = await formMatchViaLikes(rohanAuth, rohan);

    const [sLow, sHigh] = [viewer.account.id, suspPeer.account.id].sort();
    await prisma.match.create({
      data: {
        userLowId: sLow,
        userHighId: sHigh,
        status: 'active',
        conversation: { create: { status: 'active' } },
      },
    });

    console.log('4. Launching Headless Edge Browser -> Real Next.js /matches & /chats E2E...');
    const userDataDir = path.join(os.tmpdir(), `smn-e2e-matches-edge-${Date.now()}`);
    edgeProc = spawn(
      EDGE_PATH,
      ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9226', `--user-data-dir=${userDataDir}`, 'about:blank'],
      { stdio: 'ignore' },
    );

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const list = await fetch('http://127.0.0.1:9226/json/list').then((r) => r.json());
        const page = list.find((t) => t.type === 'page');
        if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch {}
    }
    assert.ok(wsUrl, 'Edge CDP failed to connect');

    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    const evalJs = async (expression) => {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(`Browser JS exception: ${JSON.stringify(r.exceptionDetails)}`);
      return r.result?.value;
    };

    const setViewport = async (width, height) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await wait(250);
    };

    await setViewport(1440, 900);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/matches` });
    await wait(900);
    const unauthUrl = await evalJs('window.location.href');
    assert.ok(unauthUrl.includes('/login'), `Expected unauthenticated /matches redirect to /login, got ${unauthUrl}`);

    // Login through Next.js BFF
    const loginRes = await evalJs(`(async () => {
      const c = await fetch('/api/auth/csrf').then(r => r.json());
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SMN-CSRF': c.csrfToken },
        body: JSON.stringify({ email: 'viewer@ds.study.iitm.ac.in', password: 'AuditPassword123!' }),
      });
      return { status: res.status, body: await res.json() };
    })()`);
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.accessToken, undefined);

    // Check raw BFF /dating/matches response privacy & caching
    const matchesProbe = await evalJs(`(async () => {
      const r = await fetch('/api/bff/v1/dating/matches');
      return {
        status: r.status,
        cacheControl: r.headers.get('cache-control') || '',
        vary: r.headers.get('vary') || '',
        body: await r.json(),
      };
    })()`);
    assert.equal(matchesProbe.status, 200);
    assert.ok(matchesProbe.cacheControl.includes('no-store'));
    assert.ok(matchesProbe.vary.toLowerCase().includes('cookie'));
    assert.equal(matchesProbe.body.length, 3, 'Must return only the 3 active eligible matches');
    const forbiddenKeys = new Set([
      'matchedAccountId',
      'accountId',
      'userLowId',
      'userHighId',
      'senderAccountId',
      'partnerAccountId',
      's3Key',
      'dateOfBirth',
      'email',
      'rollNumber',
      'moderationNotes',
      'verifiedBy',
    ]);
    const collectedNonUrlValues = [];
    const inspectNode = (node) => {
      if (!node || typeof node !== 'object') {
        collectedNonUrlValues.push(String(node));
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) inspectNode(item);
        return;
      }
      for (const [k, v] of Object.entries(node)) {
        assert.equal(forbiddenKeys.has(k), false, `Forbidden sensitive field leaked in matches payload: ${k}`);
        if (k === 'photoUrl' && v !== null) {
          assert.equal(typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://')), true, 'photoUrl must be a signed HTTP URL, never a raw storage key');
          continue;
        }
        inspectNode(v);
      }
    };
    inspectNode(matchesProbe.body);
    const nonUrlText = collectedNonUrlValues.join(' | ');
    for (const acc of [viewer.account.id, kavya.account.id, arjunHidden.account.id, rohan.account.id, racePeer.account.id, suspPeer.account.id]) {
      assert.equal(nonUrlText.includes(acc), false, `Matches payload leaked internal accountId ${acc} outside signed media URLs`);
    }
    const serializedBff = JSON.stringify(matchesProbe.body);
    assert.equal(serializedBff.includes('SuspendedMatch'), false, 'Suspended partner must stay excluded');

    // Open /matches UI
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/matches` });
    await wait(1400);

    const workspaceState = await evalJs(`(() => ({
      txt: document.body.innerText,
      imgs: Array.from(document.querySelectorAll('img')).map(i => ({ complete: i.complete, nw: i.naturalWidth })),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }))()`);
    assert.equal(workspaceState.overflow, false);
    assert.equal(workspaceState.txt.includes(', null'), false);
    assert.ok(workspaceState.txt.toLowerCase().includes('3 active'));
    assert.ok(workspaceState.txt.includes('Kavya Nair'));
    assert.ok(workspaceState.txt.includes('Arjun PrivateAge'));
    assert.ok(workspaceState.txt.includes('Rohan Mehta'));
    assert.ok(workspaceState.imgs.length >= 3 && workspaceState.imgs.every((i) => i.complete && i.nw > 0));

    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '01_desktop_1440_matches_workspace.png'), Buffer.from(data, 'base64')),
    );

    // Select Arjun PrivateAge on workbench to verify hidden-age privacy disclosure
    await evalJs(`document.querySelector('[data-testid="match-card-${arjunMatch.matchId}"] button')?.click()`);
    await wait(500);
    const arjunTxt = await evalJs('document.body.innerText');
    assert.ok(arjunTxt.includes('Age set to private'));
    assert.equal(arjunTxt.includes('Arjun PrivateAge, 25'), false);

    // Select Kavya & click Open Conversation -> navigates cleanly to /chats?matchId=...&conversationId=...
    await evalJs(`document.querySelector('[data-testid="match-card-${kavyaMatch.matchId}"] button')?.click()`);
    await wait(500);
    await evalJs(`document.querySelector('[data-testid="workbench-open-conversation-btn"]')?.click()`);
    await wait(1400);

    const chatUrl = await evalJs('window.location.href');
    assert.ok(chatUrl.includes('/chats') && chatUrl.includes(kavyaMatch.matchId) && chatUrl.includes(kavyaMatch.conversationId));

    // Send a real persisted message via Chats UI -> /api/bff/v1/messaging/conversations/:conversationId/messages
    await evalJs(`(() => {
      const inp = document.querySelector('textarea[placeholder*="Message Kavya"], input[placeholder*="Message Kavya"]');
      const proto = inp?.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(inp, 'Hello Kavya from Matches!');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(200);
    await evalJs(`document.querySelector('button[aria-label="Send message"]')?.click()`);
    await wait(800);
    const chatTxt = await evalJs('document.body.innerText');
    assert.ok(chatTxt.includes('Hello Kavya from Matches!'), 'Sent chat message must render cleanly');

    const bffMsgsProbe = await evalJs(`(async () => {
      const r = await fetch('/api/bff/v1/messaging/conversations/${kavyaMatch.conversationId}/messages');
      return { status: r.status, body: await r.json() };
    })()`);
    assert.equal(bffMsgsProbe.status, 200);
    const msgsJson = JSON.stringify(bffMsgsProbe.body);
    assert.equal(msgsJson.includes('senderAccountId'), false, 'BFF messages must not leak senderAccountId');
    assert.equal(msgsJson.includes('partnerAccountId'), false, 'BFF messages must not leak partnerAccountId');
    assert.equal(msgsJson.includes(viewer.account.id), false, 'BFF messages must not leak viewer accountId');
    assert.equal(msgsJson.includes(kavya.account.id), false, 'BFF messages must not leak partner accountId');

    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '02_desktop_1440_chats_from_match.png'), Buffer.from(data, 'base64')),
    );

    // Return to /matches and verify lastMessage snippet displays cleanly
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/matches` });
    await wait(1200);
    const afterMsgTxt = await evalJs('document.body.innerText');
    assert.ok(afterMsgTxt.includes('You: Hello Kavya from Matches!'), 'Matches list should show sanitized last message summary');

    // Open Unmatch dialog on Kavya -> Cancel first -> verify match preserved!
    await evalJs(`document.querySelector('[data-testid="match-card-${kavyaMatch.matchId}"] button')?.click()`);
    await wait(400);
    await evalJs(`document.querySelector('[data-testid="workbench-unmatch-btn"]')?.click()`);
    await wait(350);
    const dialogTxt = await evalJs(`document.querySelector('[data-testid="unmatch-confirm-dialog"]')?.innerText || ''`);
    assert.ok(dialogTxt.includes('not be automatically blocked'));
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '03_desktop_1440_unmatch_dialog.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[data-testid="cancel-unmatch-btn"]')?.click()`);
    await wait(300);
    assert.equal(await evalJs(`Boolean(document.querySelector('[data-testid="match-card-${kavyaMatch.matchId}"]'))`), true, 'Cancelling unmatch must preserve Match');

    // Repeat Unmatch -> Confirm -> verify removed from UI, ended in PostgreSQL, NO UserBlock created!
    await evalJs(`document.querySelector('[data-testid="workbench-unmatch-btn"]')?.click()`);
    await wait(300);
    await evalJs(`document.querySelector('[data-testid="confirm-unmatch-btn"]')?.click()`);
    await wait(800);

    const kavyaCardStillThere = await evalJs(`Boolean(document.querySelector('[data-testid="match-card-${kavyaMatch.matchId}"]'))`);
    assert.equal(kavyaCardStillThere, false, 'Unmatched card must leave active Matches UI immediately');
    const dbKavyaMatch = await prisma.match.findUnique({
      where: { id: kavyaMatch.matchId },
      include: { conversation: true },
    });
    assert.equal(dbKavyaMatch.status, 'ended');
    assert.equal(dbKavyaMatch.conversation.status, 'closed');
    assert.equal(await prisma.userBlock.count(), 0, 'Ordinary unmatch MUST NOT create any UserBlock row');

    // Former partner Kavya ALSO loses access (match detail + messaging + stale Like reactivation all fail 403!)
    const kavyaPostDetail = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/matches/${kavyaMatch.matchId}`, {
      headers: { Authorization: `Bearer ${kavyaApiAuth.accessToken}` },
    });
    assert.equal(kavyaPostDetail.status, 403);
    const kavyaPostMsg = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kavyaApiAuth.accessToken}` },
      body: JSON.stringify({ bodyText: 'Hello after unmatch?' }),
    });
    assert.equal(kavyaPostMsg.status, 403);
    const kavyaReactivate = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kavyaApiAuth.accessToken}` },
      body: JSON.stringify({ targetProfileId: viewer.profile.id }),
    });
    assert.equal(kavyaReactivate.status, 403, 'Ended match must not reactivate from stale/new Like');

    // Navigating back / directly to ended conversation shows ended-connection state instead of active chat
    await cdp.send('Page.navigate', {
      url: `http://127.0.0.1:${WEB_PORT}/chats?matchId=${kavyaMatch.matchId}&conversationId=${kavyaMatch.conversationId}`,
    });
    await wait(1200);
    const endedChatPresent = await evalJs(`Boolean(document.querySelector('[data-testid="ended-conversation-notice"]'))`);
    assert.equal(endedChatPresent, true, 'Ended conversation URL must render explicit ended notice and block composer');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '04_desktop_1440_chats_ended_after_unmatch.png'), Buffer.from(data, 'base64')),
    );

    // Return to /matches -> capture responsive views (2 active matches: Arjun + Rohan)
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/matches` });
    await wait(1200);
    for (const [label, w, h] of [
      ['09_desktop_1280_matches', 1280, 800],
      ['10_tablet_768_matches', 768, 1024],
      ['11_mobile_430_matches', 430, 932],
      ['12_mobile_375_matches', 375, 812],
    ]) {
      await setViewport(w, h);
      const hasOverflow = await evalJs('document.documentElement.scrollWidth > window.innerWidth');
      assert.equal(hasOverflow, false, `Horizontal overflow detected at viewport ${w}x${h}`);
      await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
        fs.writeFileSync(path.join(SCREENSHOT_DIR, `${label}.png`), Buffer.from(data, 'base64')),
      );
    }

    // Open mobile Profile Details modal on 375px and verify cleanly framed modal
    await evalJs(`document.querySelector('[data-testid="match-details-btn-${arjunMatch.matchId}"]')?.click()`);
    await wait(450);
    const mobileModalOk = await evalJs(`Boolean(document.querySelector('[data-testid="match-profile-modal"]'))`);
    assert.equal(mobileModalOk, true);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '13_mobile_375_match_modal.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[aria-label="Close dialog"]')?.click()`);
    await wait(250);

    // Back to Desktop 1440 -> Report Arjun (leaves match active!), then Block Rohan (creates UserBlock & drops count to 1 -> checks 1-match showcase!), then Unmatch Arjun -> checks ended empty state!
    await setViewport(1440, 900);
    await evalJs(`document.querySelector('[data-testid="match-card-${arjunMatch.matchId}"] button')?.click()`);
    await wait(400);
    await evalJs(`document.querySelector('[data-testid="workbench-report-btn"]')?.click()`);
    await wait(350);
    await evalJs(`document.querySelector('[data-testid="confirm-report-btn"]')?.click()`);
    await wait(700);
    assert.equal(await prisma.report.count(), 1, 'Safety report must persist');
    assert.equal(await prisma.match.count({ where: { status: 'active' } }), 3, 'Report alone must keep viewer active matches unchanged (2 viewer + 1 suspended row)');

    // Block Rohan via separate Block button
    await evalJs(`document.querySelector('[data-testid="match-card-${rohanMatch.matchId}"] button')?.click()`);
    await wait(400);
    await evalJs(`document.querySelector('[data-testid="workbench-block-btn"]')?.click()`);
    await wait(350);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '05_desktop_1440_block_dialog.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[data-testid="confirm-block-btn"]')?.click()`);
    await wait(700);
    assert.equal(await prisma.userBlock.count(), 1, 'Safety Block must persist UserBlock');

    // Now exactly 1 active visible match remains (Arjun Hidden) -> verify clean 1-match desktop composition
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '06_desktop_1440_single_match_workspace.png'), Buffer.from(data, 'base64')),
    );

    // Unmatch last match (Arjun) -> distinct 'Connection Closed' ended empty state!
    await evalJs(`document.querySelector('[data-testid="workbench-unmatch-btn"]')?.click()`);
    await wait(300);
    await evalJs(`document.querySelector('[data-testid="confirm-unmatch-btn"]')?.click()`);
    await wait(700);
    assert.equal(await evalJs(`Boolean(document.querySelector('[data-testid="matches-ended-empty-state"]'))`), true, 'Just-ended state must show distinct ended composition');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '07_desktop_1440_ended_empty_state.png'), Buffer.from(data, 'base64')),
    );

    // Fresh reload with 0 active matches -> distinct 'No active mutual matches yet' state
    await cdp.send('Page.reload');
    await wait(1200);
    assert.equal(await evalJs(`Boolean(document.querySelector('[data-testid="matches-empty-state"]'))`), true, 'Fresh empty matches state must render initial composition');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '08_desktop_1440_initial_empty_state.png'), Buffer.from(data, 'base64')),
    );

    const jsErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
    assert.equal(jsErrors.length, 0, `Uncaught browser JS exceptions: ${JSON.stringify(jsErrors)}`);

    console.log('PHASE3_4_REAL_E2E_ALL_PASSED');
  } finally {
    if (cdp) await cdp.close().catch(() => {});
    if (edgeProc) edgeProc.kill();
    if (webProc) webProc.kill();
    if (apiProc) apiProc.kill();
    s3Server.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('PHASE 3.4 E2E FAILED:', err);
  process.exit(1);
});
