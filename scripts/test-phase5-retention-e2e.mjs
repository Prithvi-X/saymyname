/**
 * Phase 5 Real-Stack E2E Verification:
 * - Member step-up Account Deletion (Profile UI -> BFF DELETE /api/bff/v1/identity/me -> /login?deleted=1)
 * - Safety Report 180-day Legal Hold immunity across DB + Local S3 R2 object storage
 * - RetentionPurgeService: 30d unmatch purge, 30d unheld account hard-purge & S3 delete, legal hold deferral
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
const API_PORT = 4019;
const WEB_PORT = 3014;
const S3_PORT = 9019;
const S3_BUCKET = 'saymyname-local';
const EDGE_CDP_PORT = 9233;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase5';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `f5000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(age) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age, 0, 15));
}

async function generatePortraitJpeg(colorHex, label) {
  const svg = `<svg width="400" height="480" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="480" fill="#0B0D10"/>
    <rect x="60" y="60" width="280" height="320" fill="${colorHex}" opacity="0.88"/>
    <text x="200" y="430" font-family="sans-serif" font-size="18" fill="#F0F1EE" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

function startLocalS3Server() {
  const objects = new Map();
  const deletedKeys = [];
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
          contentType: req.headers['content-type'] || 'application/octet-stream',
        });
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
        res.end();
      });
      return;
    }
    if (req.method === 'DELETE') {
      objects.delete(key);
      deletedKeys.push(key);
      res.writeHead(204);
      res.end();
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
      });
      return req.method === 'HEAD' ? res.end() : res.end(item.body);
    }
    res.writeHead(405);
    res.end();
  });
  return new Promise((resolve) =>
    server.listen(S3_PORT, '127.0.0.1', () => resolve({ server, objects, deletedKeys })),
  );
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
      const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timeout')), 10000);
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
  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await wait(120);
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
  await waitUntil(async () => cdp.evalAsync(`Boolean(document.querySelector('input[type="email"]'))`), 15000, 'login input');
  await cdp.evalAsync(`(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const eInput = document.querySelector('input[type="email"]');
    const pInput = document.querySelector('input[type="password"]');
    setter.call(eInput, ${JSON.stringify(email)});
    eInput.dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(pInput, 'AuditPassword123!');
    pInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('button[type="submit"]').click();
  })()`);
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
  process.env.DISABLE_RETENTION_WORKER = 'true';
  process.env.JWT_ACCESS_SECRET = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
  process.env.JWT_REFRESH_SECRET = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
  process.env.R2_ENDPOINT = `http://127.0.0.1:${S3_PORT}`;
  process.env.R2_FORCE_PATH_STYLE = 'true';
  process.env.R2_BUCKET_NAME = S3_BUCKET;
  process.env.R2_ACCESS_KEY_ID = 'localqa';
  process.env.R2_SECRET_ACCESS_KEY = 'localqa';

  console.log('0. Ensuring Phase 5 migrations applied on audit DB...');
  execFileSync('npx', ['--workspace=@saymyname/database', 'prisma', 'migrate', 'deploy'], {
    cwd: 'i:\\saymyname',
    env: { ...process.env, DATABASE_URL: DB_URL },
    stdio: 'pipe',
    shell: true,
  });

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  await prisma.$connect();

  let s3;
  let nestApp;
  let webProc;
  let edgeProc;
  const edgeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-p5-'));

  try {
    console.log('1. Starting local S3 and seeding verified accounts + matches...');
    s3 = await startLocalS3Server();

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
    await prisma.reportEvidenceRef.deleteMany();
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
          authSubject: `sub-p5-${slug}`,
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
          locationCity: 'Chennai',
          locationState: 'Tamil Nadu',
          intention: 'serious_relationship',
          bio: `${name} Phase 5 retention verification member.`,
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

    const userA = await seedMember(1, 'reporter_5', 'Kavya');
    const userB = await seedMember(2, 'held_del_5', 'Siddharth');
    const userC = await seedMember(3, 'clean_del_5', 'Meera');

    console.log('2. Booting NestJS API + Next.js BFF + Headless Edge...');
    const { AppModule } = require('../services/api/dist/src/app.module');
    const { RetentionPurgeService } = require('../services/api/dist/src/modules/retention/retention-purge.service');
    nestApp = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useWebSocketAdapter(new WsAdapter(nestApp));
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await nestApp.listen(API_PORT, '127.0.0.1');
    const retentionWorker = nestApp.get(RetentionPurgeService);

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
    await waitUntil(async () => (await fetch(`http://127.0.0.1:${WEB_PORT}/login`)).status < 500, 25000, 'Next.js ready');

    const apiBase = `http://127.0.0.1:${API_PORT}/api/v1`;
    const authLogin = async (email) =>
      fetch(`${apiBase}/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'AuditPassword123!' }),
      }).then((r) => r.json());

    for (const [u, hex] of [[userA, '#8580C4'], [userB, '#77C5A1'], [userC, '#E2A366']]) {
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

    // Create held match A<->B + conversation + message + S3 media object, AND unheld expired unmatched A<->C
    const tokA = (await authLogin(userA.email)).accessToken;
    const tokB = (await authLogin(userB.email)).accessToken;
    const tokC = (await authLogin(userC.email)).accessToken;

    await fetch(`${apiBase}/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokA}` },
      body: JSON.stringify({ targetProfileId: userB.profileId }),
    });
    const mAB = await fetch(`${apiBase}/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokB}` },
      body: JSON.stringify({ targetProfileId: userA.profileId }),
    }).then((r) => r.json());
    assert.equal(mAB.isMutualMatch, true);

    const convAB = await prisma.conversation.findUnique({ where: { matchId: mAB.matchId } });
    const msgAB = await fetch(`${apiBase}/messaging/conversations/${convAB.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokB}` },
      body: JSON.stringify({ bodyText: 'Message held under safety report' }),
    }).then((r) => r.json());

    // Put a synthetic voice-note S3 object attached to msgAB + one expired unheld match A<->C
    const heldVoiceKey = `voice-notes/${convAB.id}/held-clip.webm`;
    s3.objects.set(heldVoiceKey, { body: Buffer.from('HELD_WEBM_BYTES'), contentType: 'audio/webm' });
    await prisma.messageMedia.create({
      data: {
        messageId: msgAB.id,
        mediaType: 'voice_note',
        durationSeconds: 12,
        s3Key: heldVoiceKey,
        fileSizeBytes: 15,
        uploaderAccountId: userB.accountId,
      },
    });

    // User A reports msgAB -> stamps legalHoldUntil + creates ReportEvidenceRef
    const repRes = await fetch(`${apiBase}/safety/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokA}` },
      body: JSON.stringify({
        targetProfileId: userB.profileId,
        conversationId: convAB.id,
        messageId: msgAB.id,
        reportCategory: 'harassment',
        description: 'Phase 5 legal hold test',
      }),
    }).then((r) => r.json());
    assert.equal(repRes.success, true);

    // Match A<->C -> unmatch -> backdate endedAt > 30 days + seed unheld voice note
    await fetch(`${apiBase}/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokA}` },
      body: JSON.stringify({ targetProfileId: userC.profileId }),
    });
    const mAC = await fetch(`${apiBase}/dating/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokC}` },
      body: JSON.stringify({ targetProfileId: userA.profileId }),
    }).then((r) => r.json());
    const convAC = await prisma.conversation.findUnique({ where: { matchId: mAC.matchId } });
    const msgAC = await fetch(`${apiBase}/messaging/conversations/${convAC.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokC}` },
      body: JSON.stringify({ bodyText: 'Expired unheld message' }),
    }).then((r) => r.json());
    const unheldVoiceKey = `voice-notes/${convAC.id}/expired-clip.webm`;
    s3.objects.set(unheldVoiceKey, { body: Buffer.from('EXPIRED_WEBM_BYTES'), contentType: 'audio/webm' });
    await prisma.messageMedia.create({
      data: {
        messageId: msgAC.id,
        mediaType: 'voice_note',
        durationSeconds: 8,
        s3Key: unheldVoiceKey,
        fileSizeBytes: 18,
        uploaderAccountId: userC.accountId,
      },
    });

    await fetch(`${apiBase}/dating/matches/${mAC.matchId}/unmatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokA}` },
    });
    await prisma.match.update({
      where: { id: mAC.matchId },
      data: { endedAt: new Date(Date.now() - 35 * 86400_000) },
    });

    console.log('3. Testing Browser Account Deletion UI flow for Member B...');
    edgeProc = spawn(
      EDGE_PATH,
      [
        `--remote-debugging-port=${EDGE_CDP_PORT}`,
        `--user-data-dir=${edgeDir}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-allow-origins=*',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    const wsUrl = await waitUntil(async () => {
      const list = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/list`).then((r) => r.json());
      return list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    }, 15000, 'Edge CDP');

    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.setViewport(1440, 900);

    const webUrl = `http://127.0.0.1:${WEB_PORT}`;
    await loginPage(cdp, webUrl, userB.email);
    await cdp.send('Page.navigate', { url: `${webUrl}/profile` });
    await waitUntil(async () => cdp.evalAsync(`document.body.innerText.includes('Account & Security')`), 15000, 'Profile loaded');
    await cdp.evalAsync(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Account & Security')).click()`);
    await waitUntil(async () => cdp.evalAsync(`Boolean(document.querySelector('[data-testid="open-delete-account-btn"]'))`), 10000, 'Delete account button');
    await cdp.evalAsync(`document.querySelector('[data-testid="open-delete-account-btn"]').click()`);
    await waitUntil(async () => cdp.evalAsync(`Boolean(document.querySelector('[data-testid="confirm-delete-account-btn"]'))`), 5000, 'Delete dialog open');
    await cdp.screenshot('01_desktop_1440_delete_modal.png');

    await cdp.evalAsync(`(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const pw = document.querySelector('[data-testid="delete-account-password"]');
      const ph = document.querySelector('[data-testid="delete-account-phrase"]');
      setter.call(pw, 'AuditPassword123!');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(ph, 'DELETE MY ACCOUNT');
      ph.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(80);
    await cdp.evalAsync(`document.querySelector('[data-testid="confirm-delete-account-btn"]').click()`);

    await waitUntil(async () => {
      const href = await cdp.evalAsync('window.location.href');
      const txt = await cdp.evalAsync('document.body.innerText');
      return href.includes('/login?deleted=1') && txt.includes('30-day safety window');
    }, 15000, 'Redirect to /login?deleted=1 with confirmation banner');
    await cdp.screenshot('02_desktop_1440_deleted_login_banner.png');

    // Verify browser cookies cleared -> /api/auth/me returns 401
    const meStatusAfterDelete = await cdp.evalAsync(`fetch('/api/auth/me').then(r => r.status)`);
    assert.equal(meStatusAfterDelete, 401, 'Auth cookies must be cleared immediately on deletion');

    console.log('4. Deleting User C via API and running RetentionPurgeService sweep past 30-day grace...');
    await fetch(`${apiBase}/identity/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokC}` },
      body: JSON.stringify({ confirmPhrase: 'DELETE MY ACCOUNT', password: 'AuditPassword123!' }),
    }).then(async (r) => {
      assert.equal(r.status, 200);
      return r.json();
    });

    // Backdate both deleted accounts > 30 days to exercise hard purge vs legal hold deferral
    const expiredDel = new Date(Date.now() - 35 * 86400_000);
    await prisma.account.updateMany({
      where: { id: { in: [userB.accountId, userC.accountId] } },
      data: { deletedAt: expiredDel },
    });

    const summary = await retentionWorker.runRetentionSweep();
    assert.equal(summary.purgedConversations, 1, 'Only unheld unmatched conversation purged');
    assert.equal(summary.purgedAccounts, 1, 'Only unheld deleted account (User C) hard-purged');
    assert.ok(summary.skippedLegalHoldCount >= 1, 'Legally held conversation/account deferred cleanly');

    // Verify S3 object cleanup vs legal-hold preservation
    assert.equal(s3.objects.has(unheldVoiceKey), false, 'Expired unheld voice note removed from S3');
    assert.equal(s3.objects.has(heldVoiceKey), true, 'Legally held voice note preserved in S3');

    const userCAfter = await prisma.account.findUnique({ where: { id: userC.accountId } });
    assert.equal(userCAfter.accountStatus, 'deleted');
    assert.ok(userCAfter.email.startsWith('deleted+'));
    assert.equal(userCAfter.passwordHash, null);

    const msgABAfter = await prisma.message.findUnique({ where: { id: msgAB.id } });
    assert.ok(msgABAfter, 'Legally held message must survive purge');

    await cdp.close();
    console.log('ALL PHASE 5 ACCOUNT DELETION, LEGAL HOLD & RETENTION E2E CHECKS PASSED!', summary);
  } finally {
    try { edgeProc?.kill('SIGKILL'); } catch {}
    try { webProc?.kill('SIGKILL'); } catch {}
    try { await nestApp?.close(); } catch {}
    try { s3?.server?.close(); } catch {}
    try { await prisma.$disconnect(); } catch {}
    try { fs.rmSync(edgeDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('PHASE 5 E2E FAILED:', err);
  process.exit(1);
});
