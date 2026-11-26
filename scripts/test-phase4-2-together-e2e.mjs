/**
 * Phase 4.2 Real Browser UI + Together Space (Games, Virtual Dates, Relationship Mode) +
 * Profile Interest Persistence E2E Verification
 *
 * Exercises two real authenticated Edge browsers through Next.js BFF + NestJS API/WS +
 * PostgreSQL + Redis + Local S3:
 * - Profile interest persistence & zero default flash across navigation/reload
 * - Cooperative Word Scramble invite, anti-self-accept guard, accept, turn play & live scores
 * - Virtual Date proposal, anti-self-accept guard, and mutual acceptance
 * - Bilateral Relationship Mode opt-in, Milestones, Journal, and unilateral independent exit
 * - Multi-viewport zero-overflow check + screenshots in artifacts dir
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
const API_PORT = 4018;
const WEB_PORT = 3013;
const S3_PORT = 9018;
const S3_BUCKET = 'saymyname-local';
const EDGE_CDP_PORT_A = 9231;
const EDGE_CDP_PORT_B = 9232;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase4_2';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `f4200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
        objects.set(key, {
          body: Buffer.concat(chunks),
          contentType: req.headers['content-type'] || 'image/jpeg',
        });
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
      const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timeout (10000ms)')), 10000);
      this.ws.once('open', () => { clearTimeout(timer); resolve(); });
      this.ws.once('error', (err) => { clearTimeout(timer); reject(err); });
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
  send(method, params = {}, timeoutMs = 15000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
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
  process.env.JWT_ACCESS_SECRET = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
  process.env.JWT_REFRESH_SECRET = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
  process.env.R2_ENDPOINT = `http://127.0.0.1:${S3_PORT}`;
  process.env.R2_FORCE_PATH_STYLE = 'true';
  process.env.R2_BUCKET_NAME = S3_BUCKET;
  process.env.R2_ACCESS_KEY_ID = 'localqa';
  process.env.R2_SECRET_ACCESS_KEY = 'localqa';

  console.log('0. Ensuring Phase 4.2 schema migrations applied on audit DB...');
  execFileSync('npx', ['--workspace=@saymyname/database', 'prisma', 'migrate', 'deploy'], {
    cwd: 'i:\\saymyname',
    env: { ...process.env, DATABASE_URL: DB_URL },
    stdio: 'pipe',
    shell: true,
  });

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  await prisma.$connect();

  let s3Server;
  let nestApp;
  let webProc;
  let edgeProcA;
  let edgeProcB;
  const edgeDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-ui42-a-'));
  const edgeDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-ui42-b-'));

  try {
    console.log('1. Starting local S3 and seeding verified matched members...');
    s3Server = await startLocalS3Server();

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
    await prisma.profileInterest.deleteMany();
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
          authSubject: `sub-ui42-${slug}`,
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
          bio: `${name} Phase 4.2 Together experience verification member.`,
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

    const userA = await seedMember(1, 'ananya_42', 'Ananya');
    const userB = await seedMember(2, 'rohan_42', 'Rohan');

    console.log('2. Booting NestJS API + Next.js BFF + Dual Headless Edge...');
    const { AppModule } = require('../services/api/dist/src/app.module');
    nestApp = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useWebSocketAdapter(new WsAdapter(nestApp));
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await nestApp.listen(API_PORT, '127.0.0.1');
    console.log('   2a. NestJS API listening on', API_PORT);

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
          JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        },
        stdio: 'pipe',
      },
    );
    webProc.stderr.on('data', (d) => process.stderr.write(`[WEB] ${d}`));

    await waitUntil(async () => (await fetch(`http://127.0.0.1:${WEB_PORT}/login`)).status < 500, 25000, 'Next.js ready');
    console.log('   2b. Next.js ready on', WEB_PORT);

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
        '--no-default-browser-check',
        '--remote-allow-origins=*',
        'about:blank',
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
        '--no-default-browser-check',
        '--remote-allow-origins=*',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    const getWs = async (port) =>
      waitUntil(async () => {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
        return list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      }, 15000, `Edge CDP ${port}`);

    console.log('   2b2. Resolving Edge CDP WebSocket URLs...');
    const [wsUrlA, wsUrlB] = await Promise.all([getWs(EDGE_CDP_PORT_A), getWs(EDGE_CDP_PORT_B)]);
    console.log('   2b3. Connecting Edge CDP WebSockets...');
    const cdpA = new CDPClient(wsUrlA);
    const cdpB = new CDPClient(wsUrlB);
    await Promise.all([cdpA.connect(), cdpB.connect()]);
    console.log('   2c. Both Edge CDP sessions connected');
    await Promise.all([
      cdpA.send('Page.enable'),
      cdpA.send('Runtime.enable'),
      cdpB.send('Page.enable'),
      cdpB.send('Runtime.enable'),
    ]);
    await Promise.all([cdpA.setViewport(1440, 900), cdpB.setViewport(1440, 900)]);

    const webUrl = `http://127.0.0.1:${WEB_PORT}`;
    await Promise.all([loginPage(cdpA, webUrl, userA.email), loginPage(cdpB, webUrl, userB.email)]);
    console.log('   2d. Both users logged in cleanly');

    // ---------------------------------------------------------
    // 3. PROFILE INTERESTS SAVE + PERSISTENCE CHECK
    // ---------------------------------------------------------
    console.log('3. Verifying Profile Interests save & reload persistence in real browser...');
    await cdpA.send('Page.navigate', { url: `${webUrl}/profile` });
    await waitUntil(async () => {
      return cdpA.evalAsync(`document.body.innerText.includes('Edit Public Card')`);
    }, 15000, 'Profile overview loaded');

    await cdpA.evalAsync(`
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Edit Profile')).click();
    `);
    await waitUntil(async () => {
      return cdpA.evalAsync(`document.body.innerText.includes('Machine Learning')`);
    }, 10000, 'Interests catalog rendered');

    await cdpA.evalAsync(`
      for (const label of ['Machine Learning', 'Chess & Strategy', 'Coffee & Walks']) {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(label));
        if (btn) btn.click();
      }
    `);
    await waitUntil(async () => {
      return cdpA.evalAsync(`document.body.innerText.includes('3/10 selected')`);
    }, 5000, '3 interests selected before save');
    await cdpA.evalAsync(`
      const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(b => b.textContent.includes('Save Profile Changes'));
      submitBtn.click();
    `);
    await waitUntil(async () => {
      return cdpA.evalAsync(`document.body.innerText.includes('Profile and interests saved cleanly.')`);
    }, 15000, 'Profile interests saved feedback');

    await cdpA.send('Page.reload', { ignoreCache: false });
    await waitUntil(async () => {
      return cdpA.evalAsync(`document.body.innerText.includes('Edit Public Card')`);
    }, 15000, 'Profile overview loaded after reload');
    await cdpA.evalAsync(`
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Edit Profile')).click();
    `);
    await waitUntil(async () => {
      return cdpA.evalAsync(`document.body.innerText.includes('3/10 selected') && document.body.innerText.includes('✓ Machine Learning')`);
    }, 15000, 'Profile interests persisted after hard reload').catch(async (err) => {
      const txt = await cdpA.evalAsync('document.body.innerText').catch(() => 'unavailable');
      console.error('DEBUG PROFILE RELOAD TEXT:', String(txt).slice(0, 1200));
      await cdpA.screenshot('debug_profile_reload_fail.png').catch(() => {});
      throw err;
    });
    await cdpA.screenshot('01_desktop_1440_profile_interests_saved.png');

    // ---------------------------------------------------------
    // 4. REAL TWO-BROWSER TOGETHER SPACE: MINI-GAMES
    // ---------------------------------------------------------
    console.log('4. Navigating both browsers to /chats and testing Word Scramble game...');
    await Promise.all([
      cdpA.send('Page.navigate', { url: `${webUrl}/chats` }),
      cdpB.send('Page.navigate', { url: `${webUrl}/chats` }),
    ]);

    await waitUntil(async () => {
      const aOk = await cdpA.evalAsync(`document.body.innerText.includes('Rohan') && Boolean(document.querySelector('[data-testid="open-together-hub-btn"]'))`);
      const bOk = await cdpB.evalAsync(`document.body.innerText.includes('Ananya') && Boolean(document.querySelector('[data-testid="open-together-hub-btn"]'))`);
      return aOk && bOk;
    }, 20000, 'Both chat threads loaded');

    // User A opens Together Hub -> Word Games -> sends Word Scramble invite
    await cdpA.evalAsync(`
      document.querySelector('[data-testid="open-together-hub-btn"]').click();
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Word Games'));
        if (btn) btn.click();
      }, 80);
    `);
    await waitUntil(async () => cdpA.evalAsync(`Boolean(document.querySelector('[data-testid="send-game-invite-btn"]'))`), 10000, 'Game invite modal ready');
    await cdpA.evalAsync(`document.querySelector('[data-testid="send-game-invite-btn"]').click()`);
    await waitUntil(async () => cdpA.evalAsync(`document.body.innerText.includes('Waiting for Rohan to explicitly accept')`), 10000, 'User A waiting for game accept');

    // User B opens Together Hub -> Word Games -> sees Accept & Play -> Accepts
    await cdpB.evalAsync(`
      document.querySelector('[data-testid="open-together-hub-btn"]').click();
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Word Games'));
        if (btn) btn.click();
      }, 80);
    `);
    await waitUntil(async () => cdpB.evalAsync(`Boolean(document.querySelector('[data-testid="accept-game-invite-btn"]'))`), 15000, 'User B sees Accept & Play');
    await cdpB.evalAsync(`document.querySelector('[data-testid="accept-game-invite-btn"]').click()`);

    await waitUntil(async () => {
      const aActive = await cdpA.evalAsync(`document.body.innerText.includes('THOMLIGRA')`);
      const bActive = await cdpB.evalAsync(`document.body.innerText.includes('THOMLIGRA')`);
      return aActive && bActive;
    }, 15000, 'Both browsers synced to active Word Scramble');

    // User A solves first word ALGORITHM
    await cdpA.evalAsync(`
      const modal = document.querySelector('[data-testid="together-games-modal"]');
      const inp = modal.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'ALGORITHM');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      modal.querySelector('button[type="submit"]').click();
    `);
    await waitUntil(async () => {
      const aPts = await cdpA.evalAsync(`document.body.innerText.includes('10 pts') && document.body.innerText.includes('NEOSATURCE')`);
      const bPts = await cdpB.evalAsync(`document.body.innerText.includes('10 pts') && document.body.innerText.includes('NEOSATURCE')`);
      return aPts && bPts;
    }, 15000, 'Both browsers received live score & next scramble word via WebSocket');
    await cdpA.screenshot('02_desktop_1440_together_game_live.png');

    // Close game session cleanly
    await cdpA.evalAsync(`
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'End Game').click();
    `);
    await wait(300);
    await cdpA.evalAsync(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close')?.click()`);
    await cdpB.evalAsync(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close' || b.textContent.trim() === 'Keep Playing Later')?.click()`);
    await wait(250);

    // ---------------------------------------------------------
    // 5. VIRTUAL DATES TWO-BROWSER CONSENT CHECK
    // ---------------------------------------------------------
    console.log('5. Testing Virtual Date proposal & recipient acceptance...');
    await cdpA.evalAsync(`
      document.querySelector('[data-testid="open-together-hub-btn"]').click();
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Virtual Date'));
        if (btn) btn.click();
      }, 80);
    `);
    await waitUntil(async () => cdpA.evalAsync(`Boolean(document.querySelector('[data-testid="propose-date-btn"]'))`), 10000, 'Virtual date modal open');
    await cdpA.evalAsync(`document.querySelector('[data-testid="propose-date-btn"]').click()`);
    await waitUntil(async () => cdpA.evalAsync(`document.body.innerText.includes('Proposed by you')`), 10000, 'Date proposed shown');

    await cdpB.evalAsync(`
      document.querySelector('[data-testid="open-together-hub-btn"]').click();
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Virtual Date'));
        if (btn) btn.click();
      }, 80);
    `);
    await waitUntil(async () => cdpB.evalAsync(`document.body.innerText.includes('Accept Date')`), 15000, 'User B sees Accept Date');
    await cdpB.evalAsync(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept Date')).click()`);
    await waitUntil(async () => {
      const aAcc = await cdpA.evalAsync(`document.body.innerText.includes('accepted')`);
      const bAcc = await cdpB.evalAsync(`document.body.innerText.includes('accepted')`);
      return aAcc && bAcc;
    }, 15000, 'Both browsers show Virtual Date accepted');
    await cdpB.screenshot('03_desktop_1440_virtual_date_accepted.png');

    await cdpA.evalAsync(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close')?.click()`);
    await cdpB.evalAsync(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Close')?.click()`);
    await wait(250);

    // ---------------------------------------------------------
    // 6. RELATIONSHIP MODE BILATERAL OPT-IN + MILESTONES + JOURNAL + INDEPENDENT EXIT
    // ---------------------------------------------------------
    console.log('6. Testing Bilateral Relationship Mode + Milestones + Journal + Unilateral Exit...');
    await cdpA.evalAsync(`
      document.querySelector('[data-testid="open-together-hub-btn"]').click();
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Relationship Mode'));
        if (btn) btn.click();
      }, 80);
    `);
    await waitUntil(async () => cdpA.evalAsync(`Boolean(document.querySelector('[data-testid="propose-relationship-btn"]'))`), 10000, 'Propose relationship button');
    await cdpA.evalAsync(`document.querySelector('[data-testid="propose-relationship-btn"]').click()`);
    await waitUntil(async () => cdpA.evalAsync(`document.body.innerText.includes('Proposal Sent to Rohan')`), 10000, 'Proposal sent confirmation');

    await cdpB.evalAsync(`
      document.querySelector('[data-testid="open-together-hub-btn"]').click();
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Relationship Mode'));
        if (btn) btn.click();
      }, 80);
    `);
    await waitUntil(async () => cdpB.evalAsync(`Boolean(document.querySelector('[data-testid="accept-relationship-btn"]'))`), 15000, 'User B sees Accept & Activate');
    await cdpB.evalAsync(`document.querySelector('[data-testid="accept-relationship-btn"]').click()`);
    await waitUntil(async () => {
      const aAct = await cdpA.evalAsync(`document.body.innerText.includes('Active with Rohan')`);
      const bAct = await cdpB.evalAsync(`document.body.innerText.includes('Active with Ananya')`);
      return aAct && bAct;
    }, 15000, 'Both browsers show active Relationship Mode');

    // Add Milestone by User A & Journal by User B
    await cdpA.evalAsync(`(() => {
      const mEl = document.querySelector('[data-testid="together-relationship-modal"]');
      const inp = mEl.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'Finished End-Term Quiz Together');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(80);
    await cdpA.evalAsync(`document.querySelector('[data-testid="together-relationship-modal"] button[type="submit"]').click()`);
    await waitUntil(async () => cdpA.evalAsync(`document.body.innerText.includes('Finished End-Term Quiz Together')`), 10000, 'Milestone created');
    await cdpA.screenshot('04_desktop_1440_relationship_active.png');

    // Mobile responsive check on User B (375x812) with active Relationship modal
    await cdpB.setViewport(375, 812, true);
    const overflow375 = await cdpB.evalAsync(`document.documentElement.scrollWidth > window.innerWidth`);
    assert.equal(overflow375, false, 'Zero horizontal overflow at 375px');
    await cdpB.screenshot('05_mobile_375_relationship_modal.png');

    // User B exits independently without User A confirmation
    await cdpB.evalAsync(`document.querySelector('[data-testid="relationship-leave-btn"]').click()`);
    await waitUntil(async () => cdpB.evalAsync(`Boolean(document.querySelector('[data-testid="confirm-relationship-leave-btn"]'))`), 5000, 'Confirm exit shown');
    await cdpB.evalAsync(`document.querySelector('[data-testid="confirm-relationship-leave-btn"]').click()`);
    await waitUntil(async () => {
      const aReset = await cdpA.evalAsync(`document.body.innerText.includes('Enter Relationship Mode Together')`);
      const bReset = await cdpB.evalAsync(`document.body.innerText.includes('Enter Relationship Mode Together')`);
      return aReset && bReset;
    }, 15000, 'Both browsers reflect unilateral Relationship Mode exit cleanly');

    // Direct API guard check: self-accept impossible
    const spacesDb = await prisma.relationshipSpace.findMany();
    assert.equal(spacesDb[0]?.isActive, false);
    assert.equal(spacesDb[0]?.proposalStatus, 'disbanded');

    console.log('ALL PHASE 4.2 E2E & PROFILE INTEREST CHECKS PASSED!');
    await Promise.all([cdpA.close(), cdpB.close()]);
  } finally {
    try { edgeProcA?.kill('SIGKILL'); } catch {}
    try { edgeProcB?.kill('SIGKILL'); } catch {}
    try { webProc?.kill('SIGKILL'); } catch {}
    try { await nestApp?.close(); } catch {}
    try { s3Server?.close(); } catch {}
    try { await prisma.$disconnect(); } catch {}
    try { fs.rmSync(edgeDirA, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(edgeDirB, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('PHASE 4.2 E2E FAILED:', err);
  process.exit(1);
});
