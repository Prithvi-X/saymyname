/**
 * Phase 3.3 Real End-to-End Integration Verification: Likes & Interest Management
 * Exercises: Local S3 Storage + Real PostgreSQL (saymyname_phase32_audit) +
 * Real NestJS API (:4002) + Real Next.js BFF Server (:3006) + Real Microsoft Edge Browser.
 *
 * Strictly synthetic test data. Never modifies remote DB or live R2/Resend/LiveKit.
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
const API_PORT = 4002;
const WEB_PORT = 3006;
const S3_PORT = 9010;
const S3_BUCKET = 'saymyname-local';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const QA_JWT_ACCESS = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
const QA_JWT_REFRESH = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
const SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase3_3';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `f3300000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
    console.log('1. Resetting & seeding disposable PostgreSQL schema for Phase 3.3 Likes...');
    await prisma.message.deleteMany();
    await prisma.conversationMember.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.matchStateEvent.deleteMany();
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
          authSubject: `sub-${opts.slug}`,
          email: `${opts.slug}@ds.study.iitm.ac.in`,
          passwordHash,
          emailVerifiedAt: new Date(),
          accountStatus: opts.accountStatus ?? 'active',
          deletedAt: opts.deletedAt ?? null,
          displayName: opts.displayName,
        },
      });
      await prisma.accountEligibility.create({
        data: {
          accountId: account.id,
          ageStatus: opts.ageStatus ?? 'approved',
          studentStatus: opts.studentStatus ?? 'approved',
          programmeFamily: opts.programme ?? 'data_science_applications',
          pathwayCode: 'diploma',
          dateOfBirth: makeDobForAge(opts.age ?? 22),
          discoveryEligible: opts.discoveryEligible ?? true,
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
          bio: opts.bio ?? `Verified peer bio for ${opts.displayName}. Enjoys thoughtful technical discussions and quiet coffee mornings.`,
          programmeFamily: opts.programme ?? 'data_science_applications',
          termOrYear: 'Diploma Level',
          locationCity: opts.city ?? 'Chennai',
          locationState: 'Tamil Nadu',
          intention: 'serious_relationship',
          profileStatus: opts.profileStatus ?? 'live',
          ageDisplayMode: opts.ageDisplayMode ?? 'show_calculated_age',
          isPublished: opts.isPublished ?? true,
          isPaused: opts.isPaused ?? false,
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
          maxDistanceKm: 10,
          showInDiscovery: opts.showInDiscovery ?? true,
        },
      });
      return { account, profile };
    };

    const viewer = await seedMember({ num: 1, slug: 'viewer', displayName: 'Ananya Reviewer', age: 23 });
    const kabir = await seedMember({ num: 2, slug: 'kabir', displayName: 'Kabir LikeBack', age: 24, programme: 'electronic_systems', city: 'Bengaluru' });
    const nisha = await seedMember({ num: 3, slug: 'nisha', displayName: 'Nisha Passable', age: 22, programme: 'aeronautics_space', city: 'Pune' });
    const arjunHidden = await seedMember({ num: 4, slug: 'arjun', displayName: 'Arjun PrivateAge', age: 25, ageDisplayMode: 'hidden', programme: 'management_data_science' });
    const meeraP2 = await seedMember({ num: 5, slug: 'meera', displayName: 'Meera PageTwo', age: 21, programme: 'data_science_applications' });
    const vikramRace = await seedMember({ num: 6, slug: 'vikram', displayName: 'Vikram RaceTarget', age: 23, programme: 'electronic_systems' });

    // Excluded incoming senders
    const blockedSender = await seedMember({ num: 7, slug: 'blocked_s', displayName: 'Blocked Sender', age: 22 });
    const suspendedSender = await seedMember({ num: 8, slug: 'susp_s', displayName: 'Suspended Sender', age: 22, accountStatus: 'suspended' });
    const pausedSender = await seedMember({ num: 9, slug: 'paused_s', displayName: 'Paused Sender', age: 22, isPaused: true, profileStatus: 'paused', isPublished: false });
    const minorSender = await seedMember({ num: 10, slug: 'minor_s', displayName: 'Minor Sender', age: 17 });
    const endedSender = await seedMember({ num: 11, slug: 'ended_s', displayName: 'Ended Match Sender', age: 22 });

    // Sent targets
    const priyaPending = await seedMember({ num: 12, slug: 'priya', displayName: 'Priya SentPending', age: 22, programme: 'management_data_science', city: 'Hyderabad' });
    const snehaPassSecret = await seedMember({ num: 13, slug: 'sneha', displayName: 'Sneha SecretPass', age: 22, programme: 'electronic_systems' });
    const unavailSuspended = await seedMember({ num: 14, slug: 'unav_s', displayName: 'ModerationHidden Target', age: 22, accountStatus: 'suspended' });
    const unavailPaused = await seedMember({ num: 15, slug: 'unav_p', displayName: 'PausedTarget Hidden', age: 22, isPaused: true, profileStatus: 'paused', isPublished: false });
    const sentBlockedTarget = await seedMember({ num: 16, slug: 'sent_blk', displayName: 'Sent Blocked Target', age: 22 });

    console.log('2. Starting real NestJS API (:4002) & real built Next.js BFF (:3006)...');
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
      const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg });
      assert.equal(putRes.status, 200);
      const attach = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ s3Key, mimeType: 'image/jpeg', isPrimary: true, fileSizeBytes: jpeg.length }),
      });
      assert.ok(attach.status === 200 || attach.status === 201);
    };

    for (const [slug, hex, lbl] of [
      ['viewer', '#8580C4', 'VIEWER'],
      ['kabir', '#E18A62', 'KABIR'],
      ['nisha', '#77C5A1', 'NISHA'],
      ['arjun', '#8580C4', 'ARJUN'],
      ['meera', '#E6BC69', 'MEERA'],
      ['vikram', '#8580C4', 'VIKRAM'],
      ['priya', '#E18A62', 'PRIYA'],
      ['sneha', '#77C5A1', 'SNEHA'],
    ]) {
      await uploadPhoto(slug, hex, lbl);
    }

    // Seed incoming and outgoing Likes + Blocks + Passes + EndedMatch cleanly in PostgreSQL
    const baseTs = new Date('2026-11-25T10:00:00Z').getTime();
    const incomingRows = [
      { id: makeUuid(1001), from: kabir.account.id, mins: 50 },
      { id: makeUuid(1002), from: nisha.account.id, mins: 40 },
      { id: makeUuid(1003), from: arjunHidden.account.id, mins: 30 },
      { id: makeUuid(1004), from: meeraP2.account.id, mins: 20 },
      { id: makeUuid(1005), from: blockedSender.account.id, mins: 45 },
      { id: makeUuid(1006), from: suspendedSender.account.id, mins: 44 },
      { id: makeUuid(1007), from: pausedSender.account.id, mins: 43 },
      { id: makeUuid(1008), from: minorSender.account.id, mins: 42 },
      { id: makeUuid(1009), from: endedSender.account.id, mins: 41 },
    ];
    for (const row of incomingRows) {
      await prisma.like.create({
        data: {
          id: row.id,
          fromAccountId: row.from,
          toAccountId: viewer.account.id,
          status: 'active',
          createdAt: new Date(baseTs + row.mins * 60000),
          updatedAt: new Date(baseTs + row.mins * 60000),
        },
      });
    }

    await prisma.userBlock.create({
      data: { blockerId: blockedSender.account.id, blockedId: viewer.account.id, reason: 'Blocked' },
    });
    const [eLow, eHigh] = [viewer.account.id, endedSender.account.id].sort();
    await prisma.match.create({
      data: { userLowId: eLow, userHighId: eHigh, status: 'ended', endedAt: new Date() },
    });

    // Seed outgoing Sent Likes from viewer
    await prisma.like.createMany({
      data: [
        {
          id: makeUuid(2001),
          fromAccountId: viewer.account.id,
          toAccountId: priyaPending.account.id,
          status: 'active',
          createdAt: new Date(baseTs + 55 * 60000),
          updatedAt: new Date(baseTs + 55 * 60000),
        },
        {
          id: makeUuid(2002),
          fromAccountId: viewer.account.id,
          toAccountId: snehaPassSecret.account.id,
          status: 'active',
          createdAt: new Date(baseTs + 45 * 60000),
          updatedAt: new Date(baseTs + 45 * 60000),
        },
        {
          id: makeUuid(2003),
          fromAccountId: viewer.account.id,
          toAccountId: unavailSuspended.account.id,
          status: 'active',
          createdAt: new Date(baseTs + 35 * 60000),
          updatedAt: new Date(baseTs + 35 * 60000),
        },
        {
          id: makeUuid(2004),
          fromAccountId: viewer.account.id,
          toAccountId: unavailPaused.account.id,
          status: 'active',
          createdAt: new Date(baseTs + 25 * 60000),
          updatedAt: new Date(baseTs + 25 * 60000),
        },
        {
          id: makeUuid(2005),
          fromAccountId: viewer.account.id,
          toAccountId: sentBlockedTarget.account.id,
          status: 'active',
          createdAt: new Date(baseTs + 15 * 60000),
          updatedAt: new Date(baseTs + 15 * 60000),
        },
      ],
    });
    // Sneha privately passes viewer (MUST remain invisible in viewer's Sent Likes!)
    await prisma.pass.create({
      data: {
        fromAccountId: snehaPassSecret.account.id,
        toAccountId: viewer.account.id,
        expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
    });
    // Pre-existing block on sentBlockedTarget MUST hide them completely from Sent Likes
    await prisma.userBlock.create({
      data: { blockerId: sentBlockedTarget.account.id, blockedId: viewer.account.id, reason: 'Block' },
    });

    console.log('3. Testing Real Concurrent Withdraw vs Like Back Race in PostgreSQL...');
    const vikramAuth = await loginApi('vikram');
    const viewerAuthApi = await loginApi('viewer');
    const raceLikeHttp = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vikramAuth.accessToken}` },
      body: JSON.stringify({ targetProfileId: viewer.profile.id }),
    });
    const raceLikeRes = await raceLikeHttp.json();
    assert.ok(raceLikeHttp.status === 200 || raceLikeHttp.status === 201, `Unexpected race setup status ${raceLikeHttp.status}: ${JSON.stringify(raceLikeRes)}`);
    assert.ok(raceLikeRes.likeId);

    const [withdrawOutcome, likeBackOutcome] = await Promise.all([
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/likes/${raceLikeRes.likeId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vikramAuth.accessToken}` },
      }).then(async (r) => ({ status: r.status, body: await r.json() })),
      fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/likes/received/${raceLikeRes.likeId}/like-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuthApi.accessToken}` },
      }).then(async (r) => ({ status: r.status, body: await r.json() })),
    ]);

    const [vLow, vHigh] = [viewer.account.id, vikramRace.account.id].sort();
    const raceMatch = await prisma.match.findUnique({ where: { userLowId_userHighId: { userLowId: vLow, userHighId: vHigh } } });
    const raceLikeRow = await prisma.like.findUnique({ where: { id: raceLikeRes.likeId } });

    // Exactly one must win under PostgreSQL row lock: either withdraw won (409 on like-back, 0 match) OR match won (409 on withdraw, 1 active match)!
    if (raceMatch) {
      assert.ok(likeBackOutcome.status === 200 || likeBackOutcome.status === 201);
      assert.equal(withdrawOutcome.status, 409, 'Matched like must reject withdraw with 409');
      assert.equal(raceLikeRow.status, 'active');
      // Clean up race pair before UI test
      await prisma.conversationMember.deleteMany({ where: { conversation: { matchId: raceMatch.id } } });
      await prisma.conversation.deleteMany({ where: { matchId: raceMatch.id } });
      await prisma.matchStateEvent.deleteMany({ where: { matchId: raceMatch.id } });
      await prisma.match.delete({ where: { id: raceMatch.id } });
    } else {
      assert.ok(withdrawOutcome.status === 200 || withdrawOutcome.status === 201);
      assert.equal(likeBackOutcome.status, 409, 'Withdrawn like must reject like-back with 409');
      assert.equal(raceLikeRow.status, 'withdrawn');
    }
    await prisma.like.deleteMany({
      where: {
        OR: [
          { fromAccountId: vikramRace.account.id, toAccountId: viewer.account.id },
          { fromAccountId: viewer.account.id, toAccountId: vikramRace.account.id },
        ],
      },
    });

    console.log('4. Launching Headless Edge Browser -> Real Next.js Auth Login -> /likes & Discover E2E...');
    const userDataDir = path.join(os.tmpdir(), `smn-e2e-likes-edge-${Date.now()}`);
    edgeProc = spawn(
      EDGE_PATH,
      ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9225', `--user-data-dir=${userDataDir}`, 'about:blank'],
      { stdio: 'ignore' },
    );

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const list = await fetch('http://127.0.0.1:9225/json/list').then((r) => r.json());
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

    // Verify unauthenticated access to /likes redirects cleanly to /login
    await setViewport(1440, 900);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/likes` });
    await wait(900);
    const unauthUrl = await evalJs('window.location.href');
    assert.ok(unauthUrl.includes('/login'), `Expected unauthenticated /likes to redirect to /login, got ${unauthUrl}`);

    // Login via real Next.js BFF (/api/auth/login)
    const loginResult = await evalJs(`(async () => {
      const c = await fetch('/api/auth/csrf').then(r => r.json());
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SMN-CSRF': c.csrfToken },
        body: JSON.stringify({ email: 'viewer@ds.study.iitm.ac.in', password: 'AuditPassword123!' }),
      });
      return { status: res.status, body: await res.json() };
    })()`);
    assert.equal(loginResult.status, 200);
    assert.equal(loginResult.body.accessToken, undefined);

    // Check raw BFF pagination & cache isolation headers on received & sent likes
    const bffRecvProbe = await evalJs(`(async () => {
      const r = await fetch('/api/bff/v1/dating/likes/received?limit=2');
      return {
        status: r.status,
        cacheControl: r.headers.get('cache-control') || '',
        vary: r.headers.get('vary') || '',
        body: await r.json(),
      };
    })()`);
    assert.equal(bffRecvProbe.status, 200);
    assert.ok(bffRecvProbe.cacheControl.includes('no-store'));
    assert.ok(bffRecvProbe.vary.toLowerCase().includes('cookie'));
    assert.equal(bffRecvProbe.body.totalActiveCount, 4, 'Only 4 eligible incoming likes should be exposed');
    assert.equal(bffRecvProbe.body.items.length, 2);
    assert.equal(bffRecvProbe.body.hasMore, true);

    const bffRecvPage2 = await evalJs(
      `fetch('/api/bff/v1/dating/likes/received?limit=2&cursor=' + encodeURIComponent(${JSON.stringify(bffRecvProbe.body.nextCursor)})).then(r => r.json())`,
    );
    assert.equal(bffRecvPage2.items.length, 2);
    assert.equal(bffRecvPage2.hasMore, false);
    const allRecvIds = new Set([
      ...bffRecvProbe.body.items.map((i) => i.profileId),
      ...bffRecvPage2.items.map((i) => i.profileId),
    ]);
    assert.equal(allRecvIds.size, 4, 'Paginated received likes must not duplicate or skip items');
    const hiddenDto = [...bffRecvProbe.body.items, ...bffRecvPage2.items].find(
      (i) => i.profileId === arjunHidden.profile.id,
    );
    assert.equal(hiddenDto.profile.age, null);
    assert.equal(hiddenDto.profile.dateOfBirth, undefined);
    assert.equal(hiddenDto.profile.accountId, undefined);

    // Navigate to real /likes UI
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/likes` });
    await wait(1600);

    const initialUi = await evalJs(`(() => ({
      txt: document.body.innerText,
      imgs: Array.from(document.querySelectorAll('img')).map(i => ({ complete: i.complete, nw: i.naturalWidth, src: i.src })),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }))()`);
    assert.equal(initialUi.overflow, false, 'Desktop 1440 /likes must have no horizontal overflow');
    assert.equal(initialUi.txt.includes(', null'), false);
    assert.equal(initialUi.txt.includes('Blocked Sender'), false);
    assert.equal(initialUi.txt.includes('Suspended Sender'), false);
    assert.equal(initialUi.txt.includes('Paused Sender'), false);
    assert.equal(initialUi.txt.includes('Minor Sender'), false);
    assert.equal(initialUi.txt.includes('Ended Match Sender'), false);
    assert.ok(initialUi.txt.includes('Kabir LikeBack'));
    assert.ok(initialUi.txt.includes('Age set to private'));
    assert.ok(initialUi.imgs.length >= 4 && initialUi.imgs.every((i) => i.complete && i.nw > 0), 'All portrait thumbnails must load cleanly');

    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '01_desktop_1440_received_likes.png'), Buffer.from(data, 'base64')),
    );

    // Inspect Full Profile Modal for Kabir
    await evalJs(`document.querySelector('[data-testid="inspect-received-btn-${makeUuid(1001)}"]')?.click()`);
    await wait(600);
    const modalText = await evalJs(`document.querySelector('[data-testid="likes-full-profile-modal"]')?.innerText || ''`);
    assert.ok(modalText.includes('Verified peer bio for Kabir LikeBack'));
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '02_desktop_1440_received_full_profile.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[aria-label="Close dialog"]')?.click()`);
    await wait(250);

    // Pass Nisha Passable via UI
    await evalJs(`document.querySelector('[data-testid="pass-received-btn-${makeUuid(1002)}"]')?.click()`);
    await wait(600);
    const nishaPassRow = await prisma.pass.findUnique({
      where: { fromAccountId_toAccountId: { fromAccountId: viewer.account.id, toAccountId: nisha.account.id } },
    });
    assert.ok(nishaPassRow && nishaPassRow.expiresAt > new Date(), 'Passing received like must persist 30-day Pass');
    const nishaLikeRow = await prisma.like.findUnique({ where: { id: makeUuid(1002) } });
    assert.equal(nishaLikeRow.status, 'active', 'Passing received like must not expose pass state on sender Like row');

    // Like Back Kabir LikeBack via UI -> triggers Mutual Match Interval Modal!
    await evalJs(`document.querySelector('[data-testid="like-back-btn-${makeUuid(1001)}"]')?.click()`);
    await wait(700);
    const matchModalVisible = await evalJs(`Boolean(document.querySelector('[data-testid="likes-mutual-match-modal"]'))`);
    assert.equal(matchModalVisible, true, 'Like Back must open THE INTERVAL Mutual Match Modal');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '03_desktop_1440_mutual_match_modal.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[aria-label="Close dialog"]')?.click()`);
    await wait(250);

    const [kLow, kHigh] = [viewer.account.id, kabir.account.id].sort();
    const kabirMatch = await prisma.match.findUnique({
      where: { userLowId_userHighId: { userLowId: kLow, userHighId: kHigh } },
      include: { conversation: { include: { members: true } } },
    });
    assert.ok(kabirMatch && kabirMatch.status === 'active');
    assert.equal(kabirMatch.conversation.members.length, 2);

    // Switch to Sent Likes tab
    await evalJs(`Array.from(document.querySelectorAll('[role="tab"]')).find(el => el.textContent.includes('Sent Likes'))?.click()`);
    await wait(600);
    const sentUiText = await evalJs(`document.body.innerText`);
    assert.ok(sentUiText.includes('Priya SentPending'));
    assert.ok(sentUiText.includes('Sneha SecretPass'), 'Secret pass by recipient must never reveal pass in sender Sent Likes');
    assert.ok(sentUiText.includes('Member unavailable'), 'Paused/suspended outgoing targets must show redacted placeholder');
    assert.equal(sentUiText.includes('ModerationHidden'), false, 'Suspended target name must be redacted');
    assert.equal(sentUiText.includes('PausedTarget'), false, 'Paused target name must be redacted');
    assert.equal(sentUiText.includes('Sent Blocked Target'), false, 'Blocked target must not appear');
    assert.equal(sentUiText.toLowerCase().includes('suspended'), false);

    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '04_desktop_1440_sent_likes.png'), Buffer.from(data, 'base64')),
    );

    // Withdraw Priya SentPending via confirmation modal
    await evalJs(`document.querySelector('[data-testid="withdraw-like-btn-${makeUuid(2001)}"]')?.click()`);
    await wait(300);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '05_desktop_1440_withdraw_modal.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[data-testid="confirm-withdraw-btn"]')?.click()`);
    await wait(600);

    const priyaLikeAfterWithdraw = await prisma.like.findUnique({ where: { id: makeUuid(2001) } });
    assert.equal(priyaLikeAfterWithdraw.status, 'withdrawn', 'Withdraw must persist status = withdrawn in PostgreSQL');

    // Reload page cleanly on Sent tab to verify persistence
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/likes?tab=sent` });
    await wait(1200);
    const sentAfterReloadText = await evalJs(`document.body.innerText`);
    assert.ok(sentAfterReloadText.includes('Withdrawn'), 'Withdrawn status persists cleanly across reload');

    // Capture responsive screenshots across Desktop 1280, Tablet 768, Mobile 430, Mobile 375
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/likes` });
    await wait(1200);
    for (const [label, w, h] of [
      ['06_desktop_1280_likes', 1280, 800],
      ['07_tablet_768_likes', 768, 1024],
      ['08_mobile_430_likes', 430, 932],
      ['09_mobile_375_likes', 375, 812],
    ]) {
      await setViewport(w, h);
      const hasOverflow = await evalJs('document.documentElement.scrollWidth > window.innerWidth');
      assert.equal(hasOverflow, false, `Horizontal overflow detected at viewport ${w}x${h}`);
      await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
        fs.writeFileSync(path.join(SCREENSHOT_DIR, `${label}.png`), Buffer.from(data, 'base64')),
      );
    }

    // Verify Paused viewer state screenshot
    await setViewport(1440, 900);
    await prisma.profile.update({
      where: { id: viewer.profile.id },
      data: { isPaused: true, profileStatus: 'paused', isPublished: false },
    });
    await cdp.send('Page.reload');
    await wait(1200);
    const pausedTxt = await evalJs('document.body.innerText');
    assert.ok(pausedTxt.includes('Your discovery visibility is paused'));
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '10_desktop_1440_paused_likes.png'), Buffer.from(data, 'base64')),
    );

    // Restore unpaused viewer and delete remaining active incoming likes to capture Empty State
    await prisma.profile.update({
      where: { id: viewer.profile.id },
      data: { isPaused: false, profileStatus: 'live', isPublished: true },
    });
    await prisma.like.updateMany({
      where: { toAccountId: viewer.account.id, status: 'active' },
      data: { status: 'withdrawn' },
    });
    await cdp.send('Page.reload');
    await wait(1200);
    const emptyTxt = await evalJs('document.body.innerText');
    assert.ok(emptyTxt.includes('No incoming likes yet'));
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '11_desktop_1440_empty_likes.png'), Buffer.from(data, 'base64')),
    );

    const jsErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
    assert.equal(jsErrors.length, 0, `Uncaught browser JS exceptions: ${JSON.stringify(jsErrors)}`);

    console.log('PHASE3_3_REAL_E2E_ALL_PASSED');
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
  console.error('PHASE 3.3 E2E FAILED:', err);
  process.exit(1);
});
