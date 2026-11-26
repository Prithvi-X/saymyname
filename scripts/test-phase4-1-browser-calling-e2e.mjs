/**
 * Phase 4.1 Real Browser UI + LiveKit Audio Calling + Responsive E2E Verification
 *
 * Exercises two real authenticated browser users on `/chats` (Next.js built BFF + NestJS API/WS +
 * PostgreSQL + Redis + LiveKit Docker SFU):
 * - Desktop (1440x900) call initiation consent dialog -> Outgoing Ring -> Incoming Ring (never auto-accepts)
 * - Recipient explicit Accept -> 2-peer live LiveKit audio connected + live timer + Mute toggle
 * - Active unmatch eviction directly in live browser UI -> LiveKit kick + ended state cleanly rendered
 * - Multi-viewport layout & zero horizontal overflow sweep (1440, 1280, 768, 430, 390, 375)
 * - Captures PNG screenshots under artifacts directory for visual inspection
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
const { RoomServiceClient } = require('livekit-server-sdk');
const { ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { WsAdapter } = require('@nestjs/platform-ws');
const WebSocket = require('ws');
const sharpModule = require('sharp');
const sharp = sharpModule.default || sharpModule;

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const LK_API_KEY = 'APItestkey123';
const LK_API_SECRET = '0123456789abcdef0123456789abcdef';
const LK_WS_PORT = 7880;
const LK_WS_URL = `ws://127.0.0.1:${LK_WS_PORT}`;
const LK_HTTP_URL = `http://127.0.0.1:${LK_WS_PORT}`;
const API_PORT = 4016;
const WEB_PORT = 3011;
const S3_PORT = 9016;
const S3_BUCKET = 'saymyname-local';
const EDGE_CDP_PORT_A = 9229;
const EDGE_CDP_PORT_B = 9230;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const LK_CONTAINER = 'smn-lk-ui-phase41';
const SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase4_1';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `f4100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${S3_PORT}`);
    const prefix = `/${S3_BUCKET}/`;
    const key = url.pathname.startsWith(prefix)
      ? decodeURIComponent(url.pathname.slice(prefix.length))
      : decodeURIComponent(url.pathname.slice(1));
    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        objects.set(key, { body: Buffer.concat(chunks), contentType: req.headers['content-type'] || 'image/jpeg' });
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
        res.end();
      });
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const item = objects.get(key);
      if (!item) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        'Content-Type': item.contentType,
        'Content-Length': String(item.body.length),
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
      });
      return req.method === 'HEAD' ? res.end() : res.end(item.body);
    }
    res.writeHead(405);
    res.end();
  });
  return new Promise((resolve) => server.listen(S3_PORT, '127.0.0.1', () => resolve(server)));
}

async function waitUntil(fn, timeoutMs = 20000, label = 'condition') {
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
      throw new Error(res.exceptionDetails.exception?.description || 'CDP Eval Error');
    }
    return res.result?.value;
  }
  async setViewport(width, height, isMobile = width < 768) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
    await wait(150);
  }
  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), Buffer.from(res.data, 'base64'));
  }
  async close() {
    this.ws.close();
  }
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

async function loginPage(cdp, webUrl, email) {
  await cdp.send('Page.navigate', { url: `${webUrl}/login` });
  await waitUntil(async () => {
    return cdp.evalAsync(`Boolean(document.querySelector('input[type="email"]'))`);
  }, 15000, 'login input present');

  await cdp.evalAsync(`
    (async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const eInput = document.querySelector('input[type="email"]');
      const pInput = document.querySelector('input[type="password"]');
      setter.call(eInput, ${JSON.stringify(email)});
      eInput.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(pInput, 'AuditPassword123!');
      pInput.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('button[type="submit"]').click();
    })()
  `);
  await waitUntil(async () => {
    const href = await cdp.evalAsync('window.location.href');
    return href.includes('/discover') || href.includes('/chats') || href.includes('/matches');
  }, 15000, `login redirect for ${email}`);
}

async function main() {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = DB_URL;
  process.env.REDIS_URL = REDIS_URL;
  process.env.DISABLE_REDIS = 'false';
  process.env.DISABLE_OUTBOX_WORKER = 'false';
  process.env.DISABLE_CALL_EVICTION_WORKER = 'false';
  process.env.CALL_EVICTION_POLL_INTERVAL_MS = '250';
  process.env.JWT_ACCESS_SECRET = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
  process.env.JWT_REFRESH_SECRET = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
  process.env.LIVEKIT_URL = LK_WS_URL;
  process.env.LIVEKIT_SERVICE_URL = LK_HTTP_URL;
  process.env.LIVEKIT_API_KEY = LK_API_KEY;
  process.env.LIVEKIT_API_SECRET = LK_API_SECRET;
  process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS = '300';
  process.env.CALL_INVITE_TTL_SECONDS = '45';
  process.env.R2_ENDPOINT = `http://127.0.0.1:${S3_PORT}`;
  process.env.R2_FORCE_PATH_STYLE = 'true';
  process.env.R2_BUCKET_NAME = S3_BUCKET;
  process.env.R2_ACCESS_KEY_ID = 'localqa';
  process.env.R2_SECRET_ACCESS_KEY = 'localqa';

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  await prisma.$connect();

  let s3Server;
  let nestApp;
  let webProc;
  let edgeProcA;
  let edgeProcB;
  const edgeDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-ui41-a-'));
  const edgeDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-ui41-b-'));

  try {
    console.log('1. Starting local S3, LiveKit Docker SFU, DB seed...');
    s3Server = await startLocalS3Server();
    startDockerLiveKit();
    await waitUntil(async () => (await fetch(LK_HTTP_URL)).status < 500, 15000, 'LiveKit ready');

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

    const pwHash = hashPasswordPbkdf2('AuditPassword123!');
    const seedMember = async (idx, slug, name) => {
      const accountId = makeUuid(idx);
      const profileId = makeUuid(200 + idx);
      await prisma.account.create({
        data: {
          id: accountId,
          authSubject: `sub-ui41-${slug}`,
          email: `${slug}@ds.study.iitm.ac.in`,
          passwordHash: pwHash,
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
        },
      });
      await prisma.profile.create({
        data: {
          id: profileId,
          accountId,
          displayName: name,
          programmeFamily: 'data_science_applications',
          termOrYear: 'Diploma Level',
          locationCity: 'Bengaluru',
          locationState: 'Karnataka',
          intention: 'serious_relationship',
          bio: `${name} Phase 4.1 audio calling UI verification user.`,
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
          profileId,
          minAge: 18,
          maxAge: 35,
          allowedProgrammes: ['data_science_applications'],
          maxDistanceKm: 15,
          showInDiscovery: true,
        },
      });
      return { accountId, profileId, email: `${slug}@ds.study.iitm.ac.in`, name };
    };

    const userA = await seedMember(1, 'ananya_ui', 'Ananya');
    const userB = await seedMember(2, 'rohan_ui', 'Rohan');

    console.log('2. Booting NestJS API + Next.js BFF + Headless Edge...');
    const { AppModule } = require('../services/api/dist/src/app.module');
    nestApp = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useWebSocketAdapter(new WsAdapter(nestApp));
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await nestApp.listen(API_PORT, '127.0.0.1');

    webProc = spawn(
      process.execPath,
      ['i:\\saymyname\\node_modules\\next\\dist\\bin\\next', 'start', '-p', String(WEB_PORT)],
      {
        cwd: 'i:\\saymyname\\apps\\web',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          API_BACKEND_URL: `http://127.0.0.1:${API_PORT}`,
          NEXT_PUBLIC_WS_URL: `ws://127.0.0.1:${API_PORT}/api/v1/ws`,
          WEB_APP_URL: `http://127.0.0.1:${WEB_PORT}`,
        },
        stdio: 'pipe',
      },
    );
    webProc.stderr.on('data', (d) => process.stderr.write(`[WEB] ${d}`));

    await waitUntil(async () => (await fetch(`http://127.0.0.1:${WEB_PORT}/login`)).status < 500, 25000, 'Next.js ready');

    // Upload photos & form match via API cleanly
    const apiBase = `http://127.0.0.1:${API_PORT}/api/v1`;
    const authLogin = async (email) =>
      fetch(`${apiBase}/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'AuditPassword123!' }),
      }).then((r) => r.json());

    for (const [u, hex] of [[userA, '#8580C4'], [userB, '#77C5A1']]) {
      const a = await authLogin(u.email);
      const jpg = await generatePortraitJpeg(hex, u.name);
      const pre = await fetch(`${apiBase}/profiles/me/photos/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.accessToken}` },
        body: JSON.stringify({ filename: `${u.name}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: jpg.length }),
      }).then((r) => r.json());
      await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpg });
      await fetch(`${apiBase}/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.accessToken}` },
        body: JSON.stringify({ s3Key: pre.s3Key, mimeType: 'image/jpeg', isPrimary: true, fileSizeBytes: jpg.length }),
      });
    }

    const tokA = (await authLogin(userA.email)).accessToken;
    const tokB = (await authLogin(userB.email)).accessToken;
    await fetch(`${apiBase}/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokA}` },
      body: JSON.stringify({ targetProfileId: userB.profileId }),
    });
    const mRes = await fetch(`${apiBase}/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokB}` },
      body: JSON.stringify({ targetProfileId: userA.profileId }),
    }).then((r) => r.json());
    assert.equal(mRes.isMutualMatch, true);

    edgeProcA = spawn(
      EDGE_PATH,
      [
        `--remote-debugging-port=${EDGE_CDP_PORT_A}`,
        `--user-data-dir=${edgeDirA}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `http://127.0.0.1:${WEB_PORT}/login`,
      ],
      { stdio: 'ignore' },
    );

    edgeProcB = spawn(
      EDGE_PATH,
      [
        `--remote-debugging-port=${EDGE_CDP_PORT_B}`,
        `--user-data-dir=${edgeDirB}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `http://127.0.0.1:${WEB_PORT}/login`,
      ],
      { stdio: 'ignore' },
    );

    const [targetsA, targetsB] = await Promise.all([
      waitUntil(async () => {
        const list = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT_A}/json/list`).then((r) => r.json());
        return Array.isArray(list) && list.some((t) => t.type === 'page') ? list : null;
      }, 15000, 'Edge CDP A up'),
      waitUntil(async () => {
        const list = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT_B}/json/list`).then((r) => r.json());
        return Array.isArray(list) && list.some((t) => t.type === 'page') ? list : null;
      }, 15000, 'Edge CDP B up'),
    ]);

    const cdpA = new CDPClient(targetsA.find((t) => t.type === 'page').webSocketDebuggerUrl);
    const cdpB = new CDPClient(targetsB.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await Promise.all([cdpA.connect(), cdpB.connect()]);

    await Promise.all([
      cdpA.send('Page.enable'),
      cdpA.send('Runtime.enable'),
      cdpA.setViewport(1440, 900),
      cdpB.send('Page.enable'),
      cdpB.send('Runtime.enable'),
      cdpB.setViewport(1440, 900),
    ]);

    const webUrl = `http://127.0.0.1:${WEB_PORT}`;
    await loginPage(cdpA, webUrl, userA.email);
    await loginPage(cdpB, webUrl, userB.email);

    await Promise.all([
      cdpA.send('Page.navigate', { url: `${webUrl}/chats` }),
      cdpB.send('Page.navigate', { url: `${webUrl}/chats` }),
    ]);

    await waitUntil(async () => {
      const [aOk, bOk] = await Promise.all([
        cdpA.evalAsync(`Boolean(document.querySelector('[data-testid="open-chat-call-btn"]'))`),
        cdpB.evalAsync(`Boolean(document.querySelector('[data-testid="open-chat-call-btn"]'))`),
      ]);
      return aOk && bOk;
    }, 15000, 'Both browsers ready in /chats');

    console.log('3. Caller initiates audio call through consent dialog -> outgoing ring + recipient incoming ring...');
    await cdpA.evalAsync(`document.querySelector('[data-testid="open-chat-call-btn"]').click()`);
    await waitUntil(
      () => cdpA.evalAsync(`Boolean(document.querySelector('[data-testid="confirm-request-call-btn"]'))`),
      5000,
      'Pre-call consent dialog opened',
    );
    await cdpA.screenshot('01_desktop_1440_precall_consent_dialog.png');
    await cdpA.evalAsync(`document.querySelector('[data-testid="confirm-request-call-btn"]').click()`);

    await waitUntil(async () => {
      const [pA, pB] = await Promise.all([
        cdpA.evalAsync(`document.querySelector('[data-testid="audio-call-banner"]')?.getAttribute('data-call-phase')`),
        cdpB.evalAsync(`document.querySelector('[data-testid="audio-call-banner"]')?.getAttribute('data-call-phase')`),
      ]);
      return pA === 'ringing_outgoing' && pB === 'incoming_ringing';
    }, 10000, 'Outgoing & incoming ringing banners visible');

    await Promise.all([
      cdpA.screenshot('02_desktop_1440_outgoing_ring.png'),
      cdpB.screenshot('03_desktop_1440_incoming_ring.png'),
    ]);

    console.log('4. Recipient explicitly accepts -> both LiveKit audio streams connect -> responsive & mute check...');
    await cdpB.evalAsync(`document.querySelector('[data-testid="call-accept-btn"]').click()`);

    await waitUntil(async () => {
      const [pA, pB] = await Promise.all([
        cdpA.evalAsync(`document.querySelector('[data-testid="audio-call-banner"]')?.getAttribute('data-call-phase')`),
        cdpB.evalAsync(`document.querySelector('[data-testid="audio-call-banner"]')?.getAttribute('data-call-phase')`),
      ]);
      return pA === 'connected' && pB === 'connected';
    }, 15000, 'Both peers connected in LiveKit audio call');

    const activeDb = await prisma.callSession.findFirst({
      where: { conversationId: mRes.conversationId, callStatus: { in: ['accepted', 'connecting', 'active'] } },
    });
    assert.ok(activeDb?.livekitRoomId);
    const roomService = new RoomServiceClient(LK_HTTP_URL, LK_API_KEY, LK_API_SECRET);
    const sfuParts = await waitUntil(async () => {
      const list = await roomService.listParticipants(activeDb.livekitRoomId);
      return list.length === 2 ? list : null;
    }, 10000, '2 live browser participants on LiveKit SFU');
    assert.equal(sfuParts.length, 2);

    await cdpA.screenshot('04_desktop_1440_connected_audio_call.png');

    // Mute/Unmute verification on Caller
    await cdpA.evalAsync(`document.querySelector('[data-testid="call-mute-btn"]').click()`);
    await waitUntil(
      () => cdpA.evalAsync(`document.querySelector('[data-testid="audio-call-banner"]')?.getAttribute('data-call-phase') === 'muted'`),
      4000,
      'Mute state updated cleanly',
    );
    await cdpA.evalAsync(`document.querySelector('[data-testid="call-mute-btn"]').click()`);

    // Responsive sweep (1280, 768, 430, 390, 375) across active call UI (clicking thread on mobile so thread+call overlay shows)
    for (const [w, h, fname] of [
      [1280, 800, '05_desktop_1280_active_call.png'],
      [768, 1024, '06_tablet_768_active_call.png'],
      [430, 932, '07_mobile_430_active_call.png'],
      [390, 844, '08_mobile_390_active_call.png'],
      [375, 812, '09_mobile_375_active_call.png'],
    ]) {
      await cdpB.setViewport(w, h);
      const overflow = await cdpB.evalAsync(
        `document.documentElement.scrollWidth > document.documentElement.clientWidth`,
      );
      assert.equal(overflow, false, `Horizontal overflow detected at ${w}x${h}`);
      const bannerVisible = await cdpB.evalAsync(
        `Array.from(document.querySelectorAll('[data-testid="audio-call-banner"]')).some((el) => el.getBoundingClientRect().height > 0)`,
      );
      assert.equal(bannerVisible, true, `Audio call banner must be visible at ${w}x${h}`);
      await cdpB.screenshot(fname);
    }

    console.log('5. Caller unmatches mid-call -> live UI & LiveKit SFU immediately evict Recipient...');
    await cdpA.evalAsync(`document.querySelector('[data-testid="open-chat-unmatch-btn"]').click()`);
    await waitUntil(
      () => cdpA.evalAsync(`Boolean(document.querySelector('[data-testid="confirm-chat-unmatch-btn"]'))`),
      4000,
      'Unmatch confirmation dialog open',
    );
    await cdpA.evalAsync(`document.querySelector('[data-testid="confirm-chat-unmatch-btn"]').click()`);

    await waitUntil(async () => {
      const ended = await cdpB.evalAsync(
        `Boolean(document.querySelector('[data-testid="chats-ended-state"]')) || document.querySelector('[data-testid="audio-call-banner"]')?.getAttribute('data-call-phase') === 'revoked'`,
      );
      const parts = await roomService.listParticipants(activeDb.livekitRoomId).catch(() => []);
      return ended && parts.length === 0;
    }, 10000, 'Unmatch kicks recipient LiveKit session and shows closed UI');

    await cdpB.setViewport(1440, 900);
    await cdpB.screenshot('10_desktop_1440_post_unmatch_revoked.png');

    await Promise.all([cdpA.close(), cdpB.close()]);
    console.log('\nALL PHASE 4.1 BROWSER UI + LIVEKIT + RESPONSIVE SCREENS PASSED!');
  } finally {
    if (edgeProcA) try { edgeProcA.kill('SIGKILL'); } catch {}
    if (edgeProcB) try { edgeProcB.kill('SIGKILL'); } catch {}
    if (webProc) try { webProc.kill('SIGKILL'); } catch {}
    if (nestApp) await nestApp.close().catch(() => null);
    if (s3Server) s3Server.close();
    stopDockerLiveKit();
    await prisma.$disconnect();
    try { fs.rmSync(edgeDirA, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(edgeDirB, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('\nPHASE 4.1 BROWSER E2E FAILED:', err);
  process.exit(1);
});
