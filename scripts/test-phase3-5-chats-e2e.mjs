/**
 * Phase 3.5 Real End-to-End Integration Verification: Chats & Private Messaging
 *
 * Exercises:
 * - Local S3 Server (:9012)
 * - Real PostgreSQL (saymyname_phase32_audit with Phase 3.5 migration applied)
 * - Real Redis (:6379) for single-use WS tickets & cross-instance Redis Pub/Sub fan-out
 * - Two Live NestJS API + WebSocket Gateways (:4004 & :4005)
 * - Real Next.js Built BFF Server (:3008, including POST /api/auth/ws-ticket)
 * - Real Headless Microsoft Edge Browser via CDP (--use-fake-device-for-media-stream)
 * - Real `ffmpeg`-generated WebM/WAV audio verified server-side via `ffprobe`
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
const WebSocket = require('ws');
const sharpModule = require('sharp');
const sharp = sharpModule.default || sharpModule;

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const API_PORT_1 = 4004;
const API_PORT_2 = 4005;
const WEB_PORT = 3008;
const S3_PORT = 9012;
const S3_BUCKET = 'saymyname-local';
const EDGE_CDP_PORT = 9227;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const QA_JWT_ACCESS = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
const QA_JWT_REFRESH = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
const SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase3_5';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `f3500000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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

function generateFfmpegAudio(durationSec, format = 'webm') {
  const tmpFile = path.join(os.tmpdir(), `smn-qa-audio-${Date.now()}-${Math.random()}.${format}`);
  try {
    if (format === 'webm') {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `sine=frequency=440:duration=${durationSec}`,
          '-c:a',
          'libopus',
          '-f',
          'webm',
          tmpFile,
        ],
        { stdio: 'ignore' },
      );
    } else {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `sine=frequency=520:duration=${durationSec}`,
          '-c:a',
          'pcm_s16le',
          tmpFile,
        ],
        { stdio: 'ignore' },
      );
    }
    return fs.readFileSync(tmpFile);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

function startLocalS3Server() {
  const objects = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${S3_PORT}`);
    const prefix = `/${S3_BUCKET}/`;
    const key = url.pathname.startsWith(prefix)
      ? decodeURIComponent(url.pathname.slice(prefix.length))
      : decodeURIComponent(url.pathname.slice(1));

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, HEAD, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      return res.end();
    }

    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const body = Buffer.concat(chunks);

    if (req.method === 'PUT') {
      objects.set(key, {
        body,
        contentType: req.headers['content-type'] || 'application/octet-stream',
      });
      res.writeHead(200, {
        ETag: '"local-etag"',
        'Access-Control-Allow-Origin': '*',
      });
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
      const rangeHeader = String(req.headers['range'] || '');
      const rangeMatch = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = rangeMatch[2]
          ? Math.min(Number(rangeMatch[2]), item.body.length - 1)
          : item.body.length - 1;
        if (start >= item.body.length || end < start) {
          res.writeHead(416, { 'Content-Range': `bytes */${item.body.length}` });
          return res.end();
        }
        const slice = item.body.subarray(start, end + 1);
        res.writeHead(206, {
          'Content-Type': item.contentType,
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${start}-${end}/${item.body.length}`,
          'Accept-Ranges': 'bytes',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        });
        return res.end(slice);
      }
      res.writeHead(200, {
        'Content-Type': item.contentType,
        'Content-Length': String(item.body.length),
        'Accept-Ranges': 'bytes',
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

async function waitForHttp(url, timeoutMs = 25000) {
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

async function connectAuthenticatedWs(baseHttpUrl, accessToken) {
  const tRes = await fetch(`${baseHttpUrl}/api/v1/messaging/realtime/ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: '{}',
  });
  assert.equal(tRes.status === 200 || tRes.status === 201, true, 'Ticket mint failed');
  const { ticket, wsPath } = await tRes.json();

  const wsUrl = baseHttpUrl.replace(/^http/i, 'ws') + (wsPath || '/ws/messaging');
  const ws = new WebSocket(wsUrl);
  const events = [];
  ws.on('message', (raw) => {
    try {
      events.push(JSON.parse(String(raw)));
    } catch {}
  });

  await new Promise((resolve, reject) => {
    ws.once('open', () => {
      ws.send(JSON.stringify({ event: 'authenticate', data: { ticket } }));
      resolve();
    });
    ws.once('error', reject);
  });

  const waitForEvent = async (eventType, predicate = () => true, timeoutMs = 6000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const match = events.find((e) => e.eventType === eventType && predicate(e));
      if (match) return match;
      await wait(40);
    }
    throw new Error(`Timed out waiting for WS event ${eventType}. Received: ${JSON.stringify(events)}`);
  };

  await waitForEvent('connection.established');
  return { ws, ticket, events, waitForEvent };
}

async function run() {
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const { server: s3Server, objects: s3Objects } = await startLocalS3Server();

  const baseEnv = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: DB_URL,
    REDIS_URL,
    FORCE_TEST_REDIS: 'true',
    JWT_ACCESS_SECRET: QA_JWT_ACCESS,
    JWT_REFRESH_SECRET: QA_JWT_REFRESH,
    API_BACKEND_URL: `http://127.0.0.1:${API_PORT_1}`,
    WEB_APP_URL: `http://127.0.0.1:${WEB_PORT}`,
    R2_ENDPOINT: `http://127.0.0.1:${S3_PORT}`,
    R2_FORCE_PATH_STYLE: 'true',
    R2_BUCKET_NAME: S3_BUCKET,
    R2_ACCESS_KEY_ID: 'localqa',
    R2_SECRET_ACCESS_KEY: 'localqa',
  };

  let apiProc1;
  let apiProc2;
  let webProc;
  let edgeProc;
  let cdp;
  const openSockets = [];

  try {
    console.log('1. Cleaning & seeding disposable PostgreSQL schema for Phase 3.5 Chats...');
    await prisma.outboxEvent.deleteMany();
    await prisma.messageMedia.deleteMany();
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
          authSubject: `sub-m35-${opts.slug}`,
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
          bio: opts.bio ?? `Verified peer bio for ${opts.displayName}. Thoughtful conversations & steady pacing.`,
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
    const kavya = await seedMember({
      num: 2,
      slug: 'kavya',
      displayName: 'Kavya Nair',
      age: 23,
      programme: 'electronic_systems',
      city: 'Bengaluru',
    });
    const rohan = await seedMember({
      num: 3,
      slug: 'rohan',
      displayName: 'Rohan Mehta',
      age: 24,
      programme: 'management_data_science',
      city: 'Pune',
    });
    const siddharth = await seedMember({
      num: 4,
      slug: 'siddharth',
      displayName: 'Siddharth Rao',
      age: 25,
      ageDisplayMode: 'hidden',
      programme: 'aeronautics_space',
      city: 'Hyderabad',
    });
    const outsider = await seedMember({ num: 5, slug: 'outsider', displayName: 'Unmatched Stranger', age: 22 });

    console.log('2. Booting Two API/WS Instances (:4004, :4005 via Redis) & Next.js BFF (:3008)...');
    apiProc1 = spawn(process.execPath, ['services/api/dist/src/main.js'], {
      cwd: 'i:\\saymyname',
      env: { ...baseEnv, PORT: String(API_PORT_1) },
      stdio: 'pipe',
    });
    apiProc1.stderr.on('data', (d) => process.stderr.write(`[API-1] ${d}`));

    apiProc2 = spawn(process.execPath, ['services/api/dist/src/main.js'], {
      cwd: 'i:\\saymyname',
      env: { ...baseEnv, PORT: String(API_PORT_2) },
      stdio: 'pipe',
    });
    apiProc2.stderr.on('data', (d) => process.stderr.write(`[API-2] ${d}`));

    webProc = spawn(
      process.execPath,
      ['i:\\saymyname\\node_modules\\next\\dist\\bin\\next', 'start', '-p', String(WEB_PORT)],
      { cwd: 'i:\\saymyname\\apps\\web', env: { ...baseEnv, NODE_ENV: 'production' }, stdio: 'pipe' },
    );
    webProc.stderr.on('data', (d) => process.stderr.write(`[WEB] ${d}`));

    await Promise.all([
      waitForHttp(`http://127.0.0.1:${API_PORT_1}/api/v1/health`),
      waitForHttp(`http://127.0.0.1:${API_PORT_2}/api/v1/health`),
      waitForHttp(`http://127.0.0.1:${WEB_PORT}/login`),
    ]);

    const apiUrl1 = `http://127.0.0.1:${API_PORT_1}`;
    const apiUrl2 = `http://127.0.0.1:${API_PORT_2}`;

    const loginApi = async (slug) => {
      const r = await fetch(`${apiUrl1}/api/v1/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${slug}@ds.study.iitm.ac.in`, password: 'AuditPassword123!' }),
      });
      assert.equal(r.status, 200, `Login failed for ${slug}`);
      return r.json();
    };

    const uploadPhoto = async (slug, colorHex, label) => {
      const auth = await loginApi(slug);
      const jpeg = await generatePortraitJpeg(colorHex, label);
      const presign = await fetch(`${apiUrl1}/api/v1/profiles/me/photos/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ filename: `${slug}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: jpeg.length }),
      });
      const { uploadUrl, s3Key } = await presign.json();
      await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg });
      const attach = await fetch(`${apiUrl1}/api/v1/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ s3Key, mimeType: 'image/jpeg', isPrimary: true, fileSizeBytes: jpeg.length }),
      });
      assert.ok(attach.status === 200 || attach.status === 201);
    };

    for (const [slug, hex, lbl] of [
      ['viewer', '#8580C4', 'ANANYA'],
      ['kavya', '#E18A62', 'KAVYA'],
      ['rohan', '#77C5A1', 'ROHAN'],
      ['siddharth', '#E6BC69', 'SID'],
      ['outsider', '#C74B50', 'OUT'],
    ]) {
      await uploadPhoto(slug, hex, lbl);
    }

    const viewerAuth = await loginApi('viewer');
    const kavyaAuth = await loginApi('kavya');
    const rohanAuth = await loginApi('rohan');
    const sidAuth = await loginApi('siddharth');
    const outsiderAuth = await loginApi('outsider');

    const formMatch = async (peerAuth, peerObj) => {
      const r1 = await fetch(`${apiUrl1}/api/v1/dating/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
        body: JSON.stringify({ targetProfileId: peerObj.profile.id }),
      }).then((r) => r.json());
      assert.equal(r1.isMutualMatch, false);
      const r2 = await fetch(`${apiUrl1}/api/v1/dating/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peerAuth.accessToken}` },
        body: JSON.stringify({ targetProfileId: viewer.profile.id }),
      }).then((r) => r.json());
      assert.equal(r2.isMutualMatch, true);
      return r2;
    };

    // Unilateral like -> outsider & viewer have 0 conversations yet
    const uniLike = await fetch(`${apiUrl1}/api/v1/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outsiderAuth.accessToken}` },
      body: JSON.stringify({ targetProfileId: viewer.profile.id }),
    });
    assert.ok(uniLike.status === 200 || uniLike.status === 201);
    const outsiderConvs = await fetch(`${apiUrl1}/api/v1/messaging/conversations`, {
      headers: { Authorization: `Bearer ${outsiderAuth.accessToken}` },
    }).then((r) => r.json());
    assert.equal(outsiderConvs.length, 0, 'Unilateral Like MUST yield 0 conversations');

    // Create 3 mutual matches
    const kavyaMatch = await formMatch(kavyaAuth, kavya);
    const rohanMatch = await formMatch(rohanAuth, rohan);
    const sidMatch = await formMatch(sidAuth, siddharth);

    console.log('3. Verifying PostgreSQL Concurrency, Idempotency & Cross-Instance Redis WS...');
    // Concurrent message ordering race on Siddharth conversation (5 simultaneous sends!)
    const concurrentSends = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        fetch(`${apiUrl1}/api/v1/messaging/conversations/${sidMatch.conversationId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sidAuth.accessToken}`,
          },
          body: JSON.stringify({
            bodyText: `Siddharth note ${i}`,
            clientAssignedUuid: crypto.randomUUID(),
          }),
        }).then(async (r) => ({ status: r.status, body: await r.json() })),
      ),
    );
    assert.equal(concurrentSends.every((r) => r.status === 200 || r.status === 201), true);
    const seqs = concurrentSends.map((r) => Number(r.body.sequenceNo)).sort((a, b) => a - b);
    assert.deepEqual(seqs, [1, 2, 3, 4, 5], 'Concurrent sends must allocate monotonic unique sequences 1..5');

    // Duplicate Idempotency-Key & clientAssignedUuid retry check
    const idemKey = crypto.randomUUID();
    const clientUuid = crypto.randomUUID();
    const d1 = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${sidMatch.conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
        Authorization: `Bearer ${sidAuth.accessToken}`,
      },
      body: JSON.stringify({ bodyText: 'Idempotent check', clientAssignedUuid: clientUuid }),
    }).then((r) => r.json());
    const d2 = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${sidMatch.conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
        Authorization: `Bearer ${sidAuth.accessToken}`,
      },
      body: JSON.stringify({ bodyText: 'Idempotent check', clientAssignedUuid: clientUuid }),
    }).then((r) => r.json());
    assert.equal(d1.id, d2.id);
    assert.equal(d1.sequenceNo, d2.sequenceNo);
    const sidMsgCount = await prisma.message.count({ where: { conversationId: sidMatch.conversationId } });
    assert.equal(sidMsgCount, 6, 'Duplicate retry must persist strictly once');

    // WS Security: URL ticket MUST reject 4400
    const badUrlWs = new WebSocket(`ws://127.0.0.1:${API_PORT_1}/ws/messaging?ticket=spoof`);
    const badCloseCode = await new Promise((resolve) => badUrlWs.once('close', resolve));
    assert.equal(badCloseCode, 4400, 'URL ?ticket= query param MUST close 4400');

    // Cross-Instance Redis Pub/Sub Verification:
    // Kavya connects WS to Instance 2 (:4005), Viewer mints ticket on Instance 1 & connects + replay test
    const kavyaWs = await connectAuthenticatedWs(apiUrl2, kavyaAuth.accessToken);
    openSockets.push(kavyaWs.ws);
    kavyaWs.ws.send(JSON.stringify({ event: 'conversation.subscribe', data: { conversationId: kavyaMatch.conversationId } }));
    await kavyaWs.waitForEvent('conversation.subscribed');

    // Replay Kavya's single-use ticket on Instance 1 (across shared Redis GETDEL!) -> MUST fail 4401!
    const replayWs = new WebSocket(`ws://127.0.0.1:${API_PORT_1}/ws/messaging`);
    replayWs.once('open', () => {
      replayWs.send(JSON.stringify({ event: 'authenticate', data: { ticket: kavyaWs.ticket } }));
    });
    const replayClose = await new Promise((resolve) => replayWs.once('close', resolve));
    assert.equal(replayClose, 4401, 'Replayed ticket across Redis cluster MUST fail 4401');

    // Seed 34 realistic historical messages in Kavya thread spanning earlier calendar days + today
    console.log('4. Seeding multi-day conversation history + testing ffprobe Voice Note security...');
    const now = Date.now();
    for (let i = 1; i <= 34; i++) {
      const fromKavya = i % 2 === 1;
      const daysAgo = i <= 12 ? 3 : i <= 26 ? 1 : 0;
      const ts = new Date(now - daysAgo * 86400_000 - (35 - i) * 180_000);
      await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fromKavya ? kavyaAuth.accessToken : viewerAuth.accessToken}`,
        },
        body: JSON.stringify({
          bodyText: fromKavya
            ? `Historical note #${i} from Kavya: how is BS assignment ${i} progressing?`
            : `Historical reply #${i}: steadily chipping away at module ${i}!`,
        }),
      });
      await prisma.message.updateMany({
        where: { conversationId: kavyaMatch.conversationId, sequenceNo: BigInt(i) },
        data: { createdAt: ts },
      });
    }

    // Real ffprobe negative security tests: fake HTML & over-60s audio MUST reject 400 + purge R2
    const fakeHtml = Buffer.from(
      '<html><script>alert("xss")</script><body>Disguised fake webm payload padding to exceed 64 bytes</body></html>',
      'utf8',
    );
    const badPresign1 = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/voice-notes/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
      body: JSON.stringify({ filename: 'fake.webm', mimeType: 'audio/webm', durationSeconds: 5, fileSizeBytes: fakeHtml.length }),
    }).then((r) => r.json());
    assert.ok(badPresign1.uploadUrl && badPresign1.uploadToken && badPresign1.mediaRefId);
    await fetch(badPresign1.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'audio/webm' }, body: fakeHtml });
    const badAttach1 = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/voice-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
      body: JSON.stringify({
        mediaRefId: badPresign1.mediaRefId,
        uploadToken: badPresign1.uploadToken,
        durationSeconds: 5,
      }),
    });
    assert.equal(badAttach1.status, 400, 'Disguised HTML upload MUST fail ffprobe validation with 400');
    assert.equal(
      s3Objects.has(`voice_notes/${kavyaMatch.conversationId}/${badPresign1.mediaRefId}.webm`),
      false,
      'Invalid uploaded object MUST be deleted from S3',
    );

    const tooLongAudio = generateFfmpegAudio(62, 'webm');
    const badPresign2 = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/voice-notes/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
      body: JSON.stringify({ filename: 'long.webm', mimeType: 'audio/webm', durationSeconds: 45, fileSizeBytes: tooLongAudio.length }),
    }).then((r) => r.json());
    assert.ok(badPresign2.uploadUrl && badPresign2.uploadToken && badPresign2.mediaRefId, `badPresign2 failed: ${JSON.stringify(badPresign2)}`);
    await fetch(badPresign2.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'audio/webm' }, body: tooLongAudio });
    const badAttach2 = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/voice-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
      body: JSON.stringify({
        mediaRefId: badPresign2.mediaRefId,
        uploadToken: badPresign2.uploadToken,
        durationSeconds: 45,
      }),
    });
    assert.equal(badAttach2.status, 400, 'Over-60s spoofed duration audio MUST be rejected by ffprobe with 400');

    // Valid real ffmpeg WebM voice note uploaded by Kavya -> verifies Instance 1 -> Redis -> Instance 2!
    const validAudio = generateFfmpegAudio(3, 'webm');
    const vnPresign = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/voice-notes/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kavyaAuth.accessToken}` },
      body: JSON.stringify({ filename: 'kavya-hello.webm', mimeType: 'audio/webm', durationSeconds: 3, fileSizeBytes: validAudio.length }),
    }).then((r) => r.json());
    assert.ok(vnPresign.uploadUrl && vnPresign.uploadToken && vnPresign.mediaRefId);
    await fetch(vnPresign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'audio/webm' }, body: validAudio });
    const vnAttachRes = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/voice-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kavyaAuth.accessToken}` },
      body: JSON.stringify({
        mediaRefId: vnPresign.mediaRefId,
        uploadToken: vnPresign.uploadToken,
        durationSeconds: 3,
      }),
    });
    assert.ok(vnAttachRes.status === 200 || vnAttachRes.status === 201, 'Real ffmpeg WebM audio must pass ffprobe & attach');
    const vnMessage = await vnAttachRes.json();
    assert.equal(vnMessage.messageType, 'voice_note');
    assert.ok(vnMessage.mediaId && vnMessage.mediaUrl);
    assert.ok(
      vnMessage.mediaUrl.startsWith('/api/bff/v1/messaging/media/') &&
        vnMessage.mediaUrl.endsWith('/stream'),
      `Option A must return same-origin streaming URL, got ${vnMessage.mediaUrl}`,
    );
    assert.equal(JSON.stringify(vnMessage).includes('X-Amz-'), false);

    // Check Outsider DENIED stream (403) while Viewer ALLOWED (200 + 206 Range)
    const outMediaRes = await fetch(`${apiUrl1}/api/v1/messaging/media/${vnMessage.mediaId}/stream`, {
      headers: { Authorization: `Bearer ${outsiderAuth.accessToken}` },
    });
    assert.equal(outMediaRes.status, 403);

    const authStreamRes = await fetch(`${apiUrl1}/api/v1/messaging/media/${vnMessage.mediaId}/stream`, {
      headers: { Authorization: `Bearer ${viewerAuth.accessToken}`, Range: 'bytes=0-127' },
    });
    assert.equal(authStreamRes.status, 206);
    assert.equal(authStreamRes.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((authStreamRes.headers.get('cache-control') || '').includes('no-store'));

    // Check Kavya's Instance 2 WS saw cross-instance `message.created` WITHOUT leaking plaintext body/accountIds
    const vnWsEvent = await kavyaWs.waitForEvent(
      'message.created',
      (e) => e?.data?.messageId === vnMessage.id,
    );
    const wsFrameStr = JSON.stringify(vnWsEvent);
    assert.equal(wsFrameStr.includes(kavya.account.id), false, 'WS envelope MUST NEVER leak accountId');
    assert.equal(wsFrameStr.includes('s3Key'), false);

    console.log('5. Launching Headless Edge Browser -> Full Real-Time Chats UI & Visual Capture...');
    const userDataDir = path.join(os.tmpdir(), `smn-e2e-chats-edge-${Date.now()}`);
    edgeProc = spawn(
      EDGE_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--remote-debugging-port=${EDGE_CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    let cdpWsUrl = null;
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const list = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/list`).then((r) => r.json());
        const page = list.find((t) => t.type === 'page');
        if (page?.webSocketDebuggerUrl) {
          cdpWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }
    assert.ok(cdpWsUrl, 'Edge CDP failed to connect');

    cdp = new CDPClient(cdpWsUrl);
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
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/chats` });
    await wait(900);
    const unauthHref = await evalJs('window.location.href');
    assert.ok(unauthHref.includes('/login'), 'Unauthenticated /chats MUST redirect to /login');

    // Login through Next.js BFF
    const loginRes = await evalJs(`(async () => {
      const c = await fetch('/api/auth/csrf').then(r => r.json());
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SMN-CSRF': c.csrfToken },
        body: JSON.stringify({ email: 'viewer@ds.study.iitm.ac.in', password: 'AuditPassword123!' }),
      });
      return { status: res.status };
    })()`);
    assert.equal(loginRes.status, 200);

    // Verify BFF ws-ticket route headers (no-store, Vary: Cookie, valid ticket, non-empty wsUrl)
    const ticketProbe = await evalJs(`(async () => {
      const c = await fetch('/api/auth/csrf').then(r => r.json());
      const r = await fetch('/api/auth/ws-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SMN-CSRF': c.csrfToken },
        body: '{}',
      });
      return {
        status: r.status,
        cc: r.headers.get('cache-control') || '',
        vary: r.headers.get('vary') || '',
        body: await r.json(),
      };
    })()`);
    assert.equal(ticketProbe.status, 200);
    assert.ok(ticketProbe.cc.includes('no-store'));
    assert.ok(ticketProbe.vary.toLowerCase().includes('cookie'));
    assert.ok(ticketProbe.body.ticket && ticketProbe.body.wsUrl.startsWith('ws://'));

    // Navigate directly to Rohan's NEW empty match conversation -> 01 screenshot
    await cdp.send('Page.navigate', {
      url: `http://127.0.0.1:${WEB_PORT}/chats?matchId=${rohanMatch.matchId}&conversationId=${rohanMatch.conversationId}`,
    });
    await wait(1400);
    assert.equal(
      await evalJs(`Boolean(document.querySelector('[data-testid="new-conversation-threshold"]'))`),
      true,
      'Empty conversation must render Mutual Match threshold without auto-sending',
    );
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '01_desktop_1440_chats_empty_new_match.png'), Buffer.from(data, 'base64')),
    );

    // Switch to Kavya conversation (35 messages, date separators + Load earlier messages + Kavya voice note!)
    await evalJs(`document.querySelector('[data-testid="conversation-item-${kavyaMatch.conversationId}"]')?.click()`);
    await wait(1400);
    assert.equal(
      await evalJs(`Boolean(document.querySelector('[data-testid="load-older-messages-btn"]'))`),
      true,
      'History > 25 messages must render Load earlier messages button',
    );
    await evalJs(`document.querySelector('[data-testid="load-older-messages-btn"]')?.click()`);
    await wait(900);
    const histBody = await evalJs('document.body.innerText');
    assert.ok(histBody.includes('Historical note #1 from Kavya'), 'Clicking Load earlier messages must prepend message #1');
    const sepCount = await evalJs(`document.querySelectorAll('[data-testid="date-separator"]').length`);
    assert.ok(sepCount >= 2, 'Multi-day history must render multiple calendar date separators');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '02_desktop_1440_chats_history_and_dates.png'), Buffer.from(data, 'base64')),
    );

    // Realtime test: Kavya sends message from Instance 1 API -> Edge UI receives over Redis->WS without reload!
    await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kavyaAuth.accessToken}` },
      body: JSON.stringify({ bodyText: 'Live message arriving via Redis Pub/Sub!' }),
    });
    await wait(1200);
    const afterIncoming = await evalJs('document.body.innerText');
    assert.ok(afterIncoming.includes('Live message arriving via Redis Pub/Sub!'));

    // Viewer sends a message from Edge composer -> receives 'Sent' -> Kavya acks delivery -> UI updates 'Delivered'!
    await evalJs(`(() => {
      const inp = document.querySelector('textarea[placeholder*="Message Kavya"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(inp, 'Seeing your realtime ping Kavya!');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(150);
    await evalJs(`document.querySelector('button[aria-label="Send message"]')?.click()`);
    await wait(900);
    assert.ok((await evalJs('document.body.innerText')).includes('Seeing your realtime ping Kavya!'));

    const latestKavyaHist = await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/history`, {
      headers: { Authorization: `Bearer ${kavyaAuth.accessToken}` },
    }).then((r) => r.json());
    await fetch(`${apiUrl1}/api/v1/messaging/conversations/${kavyaMatch.conversationId}/delivery-ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kavyaAuth.accessToken}` },
      body: JSON.stringify({ upToSequenceNo: latestKavyaHist.latestSequenceNo }),
    });
    await wait(900);
    const deliveredTxt = await evalJs('document.body.innerText');
    assert.ok(deliveredTxt.includes('Delivered'), 'Partner delivery-ack must transition own Sent label to Delivered');
    assert.equal(/\bRead\b/.test(deliveredTxt), false, 'Must NEVER render read-receipt status');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '03_desktop_1440_chats_realtime_and_delivered.png'), Buffer.from(data, 'base64')),
    );

    // Voice Note Browser Recording Flow (Permission prompt -> Record synthetic fake device -> Stop & Preview -> Send!)
    await evalJs(`document.querySelector('[data-testid="open-voice-note-btn"]')?.click()`);
    await wait(200);
    await evalJs(`document.querySelector('[data-testid="voice-allow-record-btn"]')?.click()`);
    await wait(1900);
    await evalJs(`document.querySelector('[data-testid="voice-stop-btn"]')?.click()`);
    await wait(600);
    const previewReady = await evalJs(`Boolean(document.querySelector('[data-testid="voice-send-btn"]'))`);
    assert.equal(previewReady, true, 'Voice recorder preview with explicit Send/Discard must open without auto-sending');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '04_desktop_1440_chats_voice_preview_and_bubble.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[data-testid="voice-send-btn"]')?.click()`);
    let voicePanelTxt = '';
    for (let i = 0; i < 40; i++) {
      await wait(200);
      voicePanelTxt = await evalJs(`document.querySelector('[data-testid="voice-recorder-panel"]')?.innerText || ''`);
      if (!voicePanelTxt) break;
    }
    assert.equal(
      voicePanelTxt,
      '',
      `Real MediaRecorder WebM voice note must pass ffprobe and close recorder panel, still open with: ${voicePanelTxt}`,
    );
    assert.equal(await evalJs('window.scrollY'), 0, 'Page window must stay anchored without scrollIntoView jump');

    // Failed message & Retry flow (monkeypatch window.fetch once for messages POST, send, verify Failed+Retry, restore fetch & Retry!)
    await evalJs(`(() => {
      window.__origFetch = window.fetch;
      let failOnce = true;
      window.fetch = async (input, init) => {
        if (failOnce && typeof input === 'string' && input.includes('/messages') && init?.method === 'POST') {
          failOnce = false;
          return new Response(JSON.stringify({ message: 'Simulated offline timeout' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return window.__origFetch(input, init);
      };
      window.dispatchEvent(new Event('offline'));
      const inp = document.querySelector('textarea[placeholder*="Message Kavya"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(inp, 'Retry recovery check');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(200);
    await evalJs(`document.querySelector('button[aria-label="Send message"]')?.click()`);
    await wait(900);
    const hasFailedState = await evalJs(`document.body.innerText.includes('Failed') && Boolean(document.querySelector('[data-testid^="retry-msg-"]'))`);
    assert.equal(hasFailedState, true, 'Failed send must surface Failed state and Retry action');
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '05_desktop_1440_chats_failed_retry_offline.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`(() => {
      window.fetch = window.__origFetch || window.fetch;
      window.dispatchEvent(new Event('online'));
      document.querySelector('[data-testid^="retry-msg-"]')?.click();
    })()`);
    await wait(1200);

    // Per-Message Report modal (captures Report.messageId, leaves match active!)
    await evalJs(`document.querySelector('button[aria-label="Report message"], button[aria-label="Report voice note"]')?.click()`);
    await wait(350);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '06_desktop_1440_chats_message_report_dialog.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[data-testid="confirm-chat-report-btn"]')?.click()`);
    await wait(900);
    const reportsInDb = await prisma.report.findMany();
    assert.equal(reportsInDb.length, 1);
    assert.ok(reportsInDb[0].messageId, 'Per-message report MUST persist Report.messageId');
    assert.equal(await prisma.userBlock.count(), 0, 'Reporting MUST NOT auto-block');

    // Responsive viewports (1280x800, 768x1024, 430x932, 390x844, 375x812) with zero overflow
    for (const [label, w, h] of [
      ['09_desktop_1280_chats', 1280, 800],
      ['10_tablet_768_chats', 768, 1024],
    ]) {
      await setViewport(w, h);
      const ovf = await evalJs('document.documentElement.scrollWidth > window.innerWidth');
      assert.equal(ovf, false, `Overflow at ${w}x${h}`);
      await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
        fs.writeFileSync(path.join(SCREENSHOT_DIR, `${label}.png`), Buffer.from(data, 'base64')),
      );
    }

    // Mobile list + mobile thread views
    await setViewport(430, 932);
    await evalJs(`document.querySelector('button[aria-label="Back to conversations list"]')?.click()`);
    await wait(350);
    assert.equal(await evalJs('document.documentElement.scrollWidth > window.innerWidth'), false);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '11_mobile_430_chats_list.png'), Buffer.from(data, 'base64')),
    );

    await evalJs(`document.querySelector('[data-testid="conversation-item-${kavyaMatch.conversationId}"]')?.click()`);
    await wait(450);
    assert.equal(await evalJs('document.documentElement.scrollWidth > window.innerWidth'), false);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '12_mobile_430_chats_thread.png'), Buffer.from(data, 'base64')),
    );

    for (const [label, w, h] of [
      ['13_mobile_390_chats_thread', 390, 844],
      ['14_mobile_375_chats_thread', 375, 812],
    ]) {
      await setViewport(w, h);
      assert.equal(await evalJs('document.documentElement.scrollWidth > window.innerWidth'), false);
      const composerBox = await evalJs(`(() => {
        const el = document.querySelector('textarea[placeholder*="Message Kavya"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, wh: window.innerHeight };
      })()`);
      assert.ok(composerBox && composerBox.bottom <= composerBox.wh - 56, 'Mobile composer MUST sit cleanly above BottomNav');
      await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
        fs.writeFileSync(path.join(SCREENSHOT_DIR, `${label}.png`), Buffer.from(data, 'base64')),
      );
    }

    // Back to Desktop 1440 -> Direct Unmatch inside Chats (Cancel -> Confirm -> live WS closed + media 403 + zero UserBlock!)
    await setViewport(1440, 900);
    await evalJs(`document.querySelector('[data-testid="open-chat-unmatch-btn"]')?.click()`);
    await wait(350);
    assert.equal(await evalJs(`Boolean(document.querySelector('[data-testid="chat-unmatch-dialog"]'))`), true);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '07_desktop_1440_chats_unmatch_dialog.png'), Buffer.from(data, 'base64')),
    );
    await evalJs(`document.querySelector('[data-testid="confirm-chat-unmatch-btn"]')?.click()`);
    await wait(1100);
    assert.equal(
      await evalJs(`Boolean(document.querySelector('[data-testid="ended-conversation-notice"]'))`),
      true,
      'Unmatch from Chats must close live conversation into ended-connection guard',
    );
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '08_desktop_1440_chats_ended_guard.png'), Buffer.from(data, 'base64')),
    );

    // Kavya's Instance 2 WS MUST have received `conversation.closed` cleanly without creating a UserBlock!
    await kavyaWs.waitForEvent('conversation.closed', (e) => e?.data?.conversationId === kavyaMatch.conversationId);
    assert.equal(await prisma.userBlock.count(), 0, 'Direct Unmatch from Chats MUST NOT create UserBlock');
    const postUnmatchMedia = await fetch(`${apiUrl1}/api/v1/messaging/media/${vnMessage.mediaId}/stream`, {
      headers: { Authorization: `Bearer ${viewerAuth.accessToken}` },
    });
    assert.equal(postUnmatchMedia.status, 403, 'Post-unmatch voice media stream access MUST fail closed 403');

    // Also close Rohan (via Block API) & Siddharth (via Unmatch API) -> check initial empty inbox on reload
    await fetch(`${apiUrl1}/api/v1/safety/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
      body: JSON.stringify({ targetProfileId: rohan.profile.id, reason: 'Phase 3.5 Block E2E check' }),
    });
    assert.equal(await prisma.userBlock.count(), 1, 'Explicit Block must persist UserBlock');
    await fetch(`${apiUrl1}/api/v1/dating/matches/${sidMatch.matchId}/unmatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerAuth.accessToken}` },
      body: JSON.stringify({ reason: 'End final test match' }),
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/chats` });
    await wait(1200);
    assert.equal(await evalJs(`Boolean(document.querySelector('[data-testid="chats-empty-state"]'))`), true);
    await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
      fs.writeFileSync(path.join(SCREENSHOT_DIR, '15_desktop_1440_chats_initial_empty_inbox.png'), Buffer.from(data, 'base64')),
    );

    const jsErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
    assert.equal(jsErrors.length, 0, `Uncaught browser JS exceptions: ${JSON.stringify(jsErrors)}`);

    console.log('PHASE3_5_REAL_E2E_ALL_PASSED');
  } finally {
    for (const sock of openSockets) {
      try {
        sock.close();
      } catch {}
    }
    if (cdp) await cdp.close().catch(() => {});
    if (edgeProc) edgeProc.kill();
    if (webProc) webProc.kill();
    if (apiProc1) apiProc1.kill();
    if (apiProc2) apiProc2.kill();
    s3Server.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('PHASE 3.5 E2E FAILED:', err);
  process.exit(1);
});
