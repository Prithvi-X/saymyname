/**
 * Phase 3.2 Real End-to-End Integration Verification
 * Exercises: Local S3 Storage + Real PostgreSQL (saymyname_phase32_audit) +
 * Real NestJS API (:4001) + Real Next.js BFF Server (:3005) + Real Microsoft Edge Browser.
 *
 * Strictly synthetic test data. Never modifies remote DB or live R2/Resend/LiveKit.
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
const sharpModule = require('sharp');
const sharp = sharpModule.default || sharpModule;

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const API_PORT = 4001;
const WEB_PORT = 3005;
const S3_PORT = 9009;
const S3_BUCKET = 'saymyname-local';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const QA_JWT_ACCESS = 'e2e-audit-access-secret-do-not-use-prod-32bytes';
const QA_JWT_REFRESH = 'e2e-audit-refresh-secret-do-not-use-prod-32bytes';
const AUDIT_SCREENSHOT_DIR =
  'C:/Users/Prith/.gemini/antigravity/brain/d128fe15-1432-4ba6-b32c-ec8285fc2dcc/screenshots_phase3_2';

fs.mkdirSync(AUDIT_SCREENSHOT_DIR, { recursive: true });

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function makeUuid(n) {
  return `e2e00000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(age) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age, 0, 15));
}

async function generatePortraitJpegWithGpsExif(colorHex, label) {
  const svg = `<svg width="480" height="580" xmlns="http://www.w3.org/2000/svg">
    <rect width="480" height="580" fill="#0B0D10"/>
    <rect x="40" y="40" width="400" height="500" fill="#12161B" stroke="#343D48" stroke-width="2"/>
    <rect x="140" y="140" width="200" height="240" fill="${colorHex}" opacity="0.88"/>
    <text x="240" y="460" font-family="sans-serif" font-size="18" fill="#F0F1EE" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg))
    .withExif({ IFD0: { ImageDescription: 'SENSITIVE_GPS_EXIF_LAT_13_LON_80' } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

function buildAuthenticStillHeicBuffer(colorHex) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-e2e-heic-'));
  try {
    const mp4Path = path.join(tmpDir, 'frame.mp4');
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${colorHex}:s=320x380`, '-frames:v', '1', '-c:v', 'libx265', '-f', 'mp4', mp4Path],
      { timeout: 15000, windowsHide: true },
    );
    const mp4 = fs.readFileSync(mp4Path);
    const idxHvcc = mp4.indexOf(Buffer.from('hvcC'));
    const hvccSize = mp4.readUInt32BE(idxHvcc - 4);
    const hvccBox = mp4.subarray(idxHvcc - 4, idxHvcc - 4 + hvccSize);
    const idxMdat = mp4.indexOf(Buffer.from('mdat'));
    const mdatSize = mp4.readUInt32BE(idxMdat - 4);
    const sampleBytes = mp4.subarray(idxMdat + 4, idxMdat - 4 + mdatSize);

    const box = (type, payload) => {
      const hdr = Buffer.alloc(8);
      hdr.writeUInt32BE(8 + payload.length, 0);
      hdr.write(type, 4, 4, 'ascii');
      return Buffer.concat([hdr, payload]);
    };
    const fullbox = (type, ver, flags, payload) => {
      const vf = Buffer.alloc(4);
      vf.writeUInt32BE((ver << 24) | flags, 0);
      return box(type, Buffer.concat([vf, payload]));
    };

    const ftyp = box('ftyp', Buffer.from('heic\x00\x00\x00\x00mif1heic', 'latin1'));
    const hdlr = fullbox('hdlr', 0, 0, Buffer.concat([Buffer.alloc(4), Buffer.from('pict', 'ascii'), Buffer.alloc(13)]));
    const pitm = fullbox('pitm', 0, 0, Buffer.from([0x00, 0x01]));
    const infe = fullbox('infe', 2, 0, Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00]), Buffer.from('hvc1Image\x00', 'ascii')]));
    const iinf = fullbox('iinf', 0, 0, Buffer.concat([Buffer.from([0x00, 0x01]), infe]));
    const ispeBuf = Buffer.alloc(8);
    ispeBuf.writeUInt32BE(320, 0);
    ispeBuf.writeUInt32BE(380, 4);
    const ispe = fullbox('ispe', 0, 0, ispeBuf);
    const ipco = box('ipco', Buffer.concat([hvccBox, ispe]));
    const ipma = fullbox('ipma', 0, 0, Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02, 0x81, 0x02]));
    const iprp = box('iprp', Buffer.concat([ipco, ipma]));
    const buildMeta = (offset) => {
      const ilocPayload = Buffer.alloc(18);
      ilocPayload[0] = 0x44;
      ilocPayload.writeUInt16BE(1, 2);
      ilocPayload.writeUInt16BE(1, 4);
      ilocPayload.writeUInt16BE(0, 6);
      ilocPayload.writeUInt16BE(1, 8);
      ilocPayload.writeUInt32BE(offset, 10);
      ilocPayload.writeUInt32BE(sampleBytes.length, 14);
      const iloc = fullbox('iloc', 0, 0, ilocPayload);
      return fullbox('meta', 0, 0, Buffer.concat([hdlr, pitm, iinf, iprp, iloc]));
    };
    const metaLen = buildMeta(0).length;
    const meta = buildMeta(ftyp.length + metaLen + 8);
    const mdat = box('mdat', sampleBytes);
    return Buffer.concat([ftyp, meta, mdat]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function startLocalS3Server() {
  const objects = new Map();
  const s3Log = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${S3_PORT}`);
    const prefix = `/${S3_BUCKET}/`;
    const key = url.pathname.startsWith(prefix)
      ? decodeURIComponent(url.pathname.slice(prefix.length))
      : decodeURIComponent(url.pathname.slice(1));

    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const body = Buffer.concat(chunks);

    s3Log.push(`${req.method} ${key} (${body.length}b)`);

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
    server.listen(S3_PORT, '127.0.0.1', () => resolve({ server, objects, s3Log }));
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
  const { server: s3Server, objects: s3Objects } = await startLocalS3Server();

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
    console.log('1. Resetting & seeding disposable PostgreSQL schema...');
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
    const ids = {
      viewer: makeUuid(1),
      okHeic: makeUuid(2),
      hiddenAge: makeUuid(3),
      mutualMatchTarget: makeUuid(4),
      unilateralTarget: makeUuid(5),
      stalePauseTarget: makeUuid(6),
      passTarget: makeUuid(7),
      blockTarget: makeUuid(8),
      ageIncompatible: makeUuid(9),
      progIncompatible: makeUuid(10),
      pausedCand: makeUuid(11),
      preBlockedCand: makeUuid(12),
      missingDobCand: makeUuid(13),
      invalidPhotoCand: makeUuid(14),
      existingMatchCand: makeUuid(15),
    };

    const seedMember = async (opts) => {
      const account = await prisma.account.create({
        data: {
          id: opts.accountId,
          authSubject: `sub-${opts.slug}`,
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
          ageStatus: opts.ageStatus ?? 'approved',
          studentStatus: opts.studentStatus ?? 'approved',
          programmeFamily: opts.programme ?? 'data_science_applications',
          pathwayCode: 'diploma',
          dateOfBirth: opts.dob === null ? null : (opts.dob ?? makeDobForAge(opts.age ?? 22)),
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
          bio: opts.bio ?? `Verified peer bio for ${opts.displayName}`,
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
          minAge: opts.minAge ?? 18,
          maxAge: opts.maxAge ?? 35,
          allowedProgrammes: opts.allowedProgrammes ?? [
            'data_science_applications',
            'electronic_systems',
            'aeronautics_space',
            'management_data_science',
          ],
          maxDistanceKm: opts.maxDistanceKm ?? 10,
          showInDiscovery: opts.showInDiscovery ?? true,
        },
      });
      if (opts.seedPendingPhotoOnly) {
        await prisma.profilePhoto.create({
          data: {
            profileId: profile.id,
            s3Key: `photos/${account.id}/pending.jpg`,
            displayOrder: 0,
            isPrimary: true,
            moderationStatus: 'pending',
          },
        });
      }
      return { account, profile };
    };

    const viewer = await seedMember({ num: 1, accountId: ids.viewer, slug: 'viewer', displayName: 'Ananya Reviewer', age: 23, programme: 'data_science_applications', minAge: 20, maxAge: 28, maxDistanceKm: 5 });
    const candHeic = await seedMember({ num: 2, accountId: ids.okHeic, slug: 'cand_heic', displayName: 'Meera HEIC', age: 22, programme: 'electronic_systems', minAge: 20, maxAge: 27, city: 'Bengaluru' });
    const candHidden = await seedMember({ num: 3, accountId: ids.hiddenAge, slug: 'cand_hidden', displayName: 'Arjun Hidden', age: 24, ageDisplayMode: 'hidden', programme: 'aeronautics_space', minAge: 20, maxAge: 27 });
    const candMutual = await seedMember({ num: 4, accountId: ids.mutualMatchTarget, slug: 'cand_mutual', displayName: 'Kavya Mutual', age: 23, programme: 'management_data_science' });
    const candUni = await seedMember({ num: 5, accountId: ids.unilateralTarget, slug: 'cand_uni', displayName: 'Rohan Unilateral', age: 21, programme: 'data_science_applications' });
    const candStale = await seedMember({ num: 6, accountId: ids.stalePauseTarget, slug: 'cand_stale', displayName: 'Siddharth Stale', age: 22, programme: 'electronic_systems' });
    const candPass = await seedMember({ num: 7, accountId: ids.passTarget, slug: 'cand_pass', displayName: 'Nisha Pass', age: 22, programme: 'data_science_applications' });
    const candBlock = await seedMember({ num: 8, accountId: ids.blockTarget, slug: 'cand_block', displayName: 'Dev Block', age: 22, programme: 'aeronautics_space' });

    // Excluded candidates
    await seedMember({ num: 9, accountId: ids.ageIncompatible, slug: 'excl_age', displayName: 'Excluded AgeReverse', age: 22, minAge: 18, maxAge: 20 });
    await seedMember({ num: 10, accountId: ids.progIncompatible, slug: 'excl_prog', displayName: 'Excluded ProgReverse', age: 22, allowedProgrammes: ['electronic_systems'] });
    await seedMember({ num: 11, accountId: ids.pausedCand, slug: 'excl_paused', displayName: 'Excluded Paused', age: 22, isPaused: true, profileStatus: 'paused', isPublished: false });
    const preBlocked = await seedMember({ num: 12, accountId: ids.preBlockedCand, slug: 'excl_blocked', displayName: 'Excluded PreBlocked', age: 22 });
    const missingDob = await seedMember({ num: 13, accountId: ids.missingDobCand, slug: 'excl_nodob', displayName: 'Excluded MissingDob', dob: null });
    await seedMember({ num: 14, accountId: ids.invalidPhotoCand, slug: 'excl_nophoto', displayName: 'Excluded BadPhoto', age: 22, seedPendingPhotoOnly: true });
    const existingMatch = await seedMember({ num: 15, accountId: ids.existingMatchCand, slug: 'excl_matched', displayName: 'Excluded ExistingMatch', age: 22 });

    // Seed blocks, reciprocal incoming like for Kavya Mutual, and an existing active Match for ExistingMatch
    await prisma.userBlock.create({ data: { blockerId: preBlocked.account.id, blockedId: viewer.account.id, reason: 'Pre-existing block' } });
    await prisma.like.create({ data: { fromAccountId: candMutual.account.id, toAccountId: viewer.account.id, status: 'active' } });
    const [mLow, mHigh] = [viewer.account.id, existingMatch.account.id].sort();
    await prisma.match.create({ data: { userLowId: mLow, userHighId: mHigh, status: 'active', conversation: { create: { status: 'active' } } } });

    console.log('2. Starting real NestJS API (:4001) & real built Next.js BFF (:3005)...');
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

    // Helper to authenticate directly against API for seeding media photos via real presign + S3 + addPhoto
    const loginApi = async (slug) => {
      const r = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${slug}@ds.study.iitm.ac.in`, password: 'AuditPassword123!' }),
      });
      assert.equal(r.status, 200, `API login failed for ${slug}`);
      return r.json();
    };

    const uploadRealPhotoViaApi = async (slug, mimeType, buffer) => {
      const auth = await loginApi(slug);
      const token = auth.accessToken;
      const presignRes = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/profiles/me/photos/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          filename: mimeType === 'image/heic' ? `${slug}.heic` : `${slug}.jpg`,
          mimeType,
          fileSizeBytes: buffer.length,
        }),
      });
      assert.ok(presignRes.status === 200 || presignRes.status === 201, `Unexpected presign status: ${presignRes.status}`);
      const { uploadUrl, s3Key } = await presignRes.json();
      assert.ok(uploadUrl && uploadUrl.includes('127.0.0.1:9009'), 'Expected real local S3 presigned URL');

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: buffer,
      });
      assert.equal(putRes.status, 200, 'PUT to presigned S3 URL failed');

      const attachRes = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ s3Key, mimeType, isPrimary: true, fileSizeBytes: buffer.length }),
      });
      return { status: attachRes.status, body: await attachRes.json(), s3Key };
    };

    console.log('3. Testing Real Presign -> Local S3 PUT -> Server Get -> Validate/Decode/Strip -> Put -> Signed GET pipeline (JPEG+EXIF, HEIC, Bad HEIC)...');
    const jpegWithExif = await generatePortraitJpegWithGpsExif('#8580C4', 'REAL DB PORTRAIT');
    for (const s of ['viewer', 'cand_hidden', 'cand_mutual', 'cand_uni', 'cand_stale', 'cand_pass', 'cand_block', 'excl_age', 'excl_prog', 'excl_paused', 'excl_blocked', 'excl_matched']) {
      const up = await uploadRealPhotoViaApi(s, 'image/jpeg', jpegWithExif);
      assert.ok(up.status === 200 || up.status === 201, `Photo upload failed for ${s}: ${up.status} ${JSON.stringify(up.body)}`);
      const storedObj = s3Objects.get(up.s3Key);
      assert.equal(storedObj.body.includes(Buffer.from('SENSITIVE_GPS_EXIF')), false, 'EXIF GPS metadata must be stripped in S3');
    }

    // Authentic iPhone-style still HEIC upload -> server decodes via ffmpeg -> re-encodes via sharp as JPEG -> stores JPEG back in S3!
    const authenticHeic = buildAuthenticStillHeicBuffer('#E18A62');
    const heicUpload = await uploadRealPhotoViaApi('cand_heic', 'image/heic', authenticHeic);
    assert.ok(heicUpload.status === 200 || heicUpload.status === 201, `Real HEIC upload + transcode should succeed cleanly: ${heicUpload.status} ${JSON.stringify(heicUpload.body)}`);
    const storedHeicConverted = s3Objects.get(heicUpload.s3Key);
    assert.equal(storedHeicConverted.contentType, 'image/jpeg', 'HEIC must normalize to browser-safe JPEG in S3');
    assert.equal(storedHeicConverted.body[0], 0xff);
    assert.equal(storedHeicConverted.body[1], 0xd8);

    // Undecodable fake HEIC uploaded to S3 MUST reject 400 & delete unusable object from S3!
    const corruptedHeic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypheic\x00\x00\x00\x00mif1heic', 'latin1'),
      Buffer.from([0x00, 0x00, 0x00, 0x14]),
      Buffer.from('meta\x00\x00\x00\x00not_real_box', 'latin1'),
      Buffer.from([0x00, 0x00, 0x00, 0x14]),
      Buffer.from('mdatgarbage_bad_hevc', 'latin1'),
    ]);
    const badHeicRes = await uploadRealPhotoViaApi('excl_nophoto', 'image/heic', corruptedHeic);
    assert.equal(badHeicRes.status, 400, 'Undecodable HEIC must fail closed with 400');
    assert.equal(s3Objects.has(badHeicRes.s3Key), false, 'Failed HEIC object must be purged from S3');

    // Verify pre-Phase-3.2 missing DOB account triggers AGE_VERIFICATION lifecycle + 403 on Discover!
    const nodobAuth = await loginApi('excl_nodob');
    assert.equal(nodobAuth.lifecycleState, 'AGE_VERIFICATION', 'Null verified DOB must require age verification');
    const nodobDiscover = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/dating/candidates`, {
      headers: { Authorization: `Bearer ${nodobAuth.accessToken}` },
    });
    assert.equal(nodobDiscover.status, 403, 'EligibilityGuard must block null-DOB legacy account from discovery');

    console.log('4. Launching Headless Edge Browser -> Real Next.js Auth Login -> BFF -> Real API -> PostgreSQL...');
    const userDataDir = path.join(os.tmpdir(), `smn-e2e-edge-${Date.now()}`);
    edgeProc = spawn(
      EDGE_PATH,
      ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9224', `--user-data-dir=${userDataDir}`, 'about:blank'],
      { stdio: 'ignore' },
    );

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const list = await fetch('http://127.0.0.1:9224/json/list').then((r) => r.json());
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

    // Navigate to /login on real Next.js server & login through /api/auth/csrf + /api/auth/login -> HttpOnly cookies!
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/login` });
    await wait(1200);
    const loginResult = await evalJs(`(async () => {
      const c = await fetch('/api/auth/csrf').then(r => r.json());
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SMN-CSRF': c.csrfToken },
        body: JSON.stringify({ email: 'viewer@ds.study.iitm.ac.in', password: 'AuditPassword123!' }),
      });
      return { status: res.status, body: await res.json() };
    })()`);
    assert.equal(loginResult.status, 200, 'Real Next.js BFF login failed');
    assert.equal(loginResult.body.accessToken, undefined, 'BFF must strip raw JWT tokens from client JSON');

    // Inspect raw BFF Discovery API response, cache isolation headers & cursor pagination directly inside authenticated browser context
    const bffProbe = await evalJs(`(async () => {
      const r = await fetch('/api/bff/v1/dating/candidates?limit=4');
      return {
        status: r.status,
        cacheControl: r.headers.get('cache-control') || '',
        vary: r.headers.get('vary') || '',
        body: await r.json(),
      };
    })()`);
    assert.equal(bffProbe.status, 200);
    assert.ok(bffProbe.cacheControl.includes('no-store'), `Expected private no-store cache header on BFF, got: ${bffProbe.cacheControl}`);
    assert.ok(bffProbe.vary.toLowerCase().includes('cookie'), `Expected Vary: Cookie header on BFF, got: ${bffProbe.vary}`);
    const feedPage1 = bffProbe.body;
    const feedPage2 = feedPage1.nextCursor
      ? await evalJs(`fetch('/api/bff/v1/dating/candidates?limit=4&cursor=' + encodeURIComponent(${JSON.stringify(feedPage1.nextCursor)})).then(r => r.json())`)
      : { candidates: [] };
    const allReturned = [...feedPage1.candidates, ...feedPage2.candidates];
    const returnedIds = new Set(allReturned.map((c) => c.profileId));

    // Verify all 7 valid targets appear & all 7 excluded records are absent
    for (const expected of [candHeic, candHidden, candMutual, candUni, candStale, candPass, candBlock]) {
      assert.ok(returnedIds.has(expected.profile.id), `Expected eligible candidate ${expected.profile.displayName} in DB feed`);
    }
    for (const excludedId of [9, 10, 11, 12, 13, 14, 15].map((n) => makeUuid(500 + n))) {
      assert.ok(!returnedIds.has(excludedId), `Excluded candidate ${excludedId} must not appear in live DB feed`);
    }
    const hiddenDto = allReturned.find((c) => c.profileId === candHidden.profile.id);
    assert.equal(hiddenDto.age, null, 'Hidden age must be null in DB API response');
    assert.equal(hiddenDto.dateOfBirth, undefined, 'DOB must never leak in DB API response');
    assert.equal(hiddenDto.accountId, undefined, 'accountId must never leak in DB API response');

    // Verify direct BFF retrieval of blocked peer denies access (404)
    const blockedDetailStatus = await evalJs(`fetch('/api/bff/v1/dating/candidates/${preBlocked.profile.id}').then(r => r.status)`);
    assert.equal(blockedDetailStatus, 404, 'Blocked peer detail lookup via BFF must deny access');

    // Load live /discover page in browser!
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/discover` });
    await wait(1800);

    // Exhaust queue interactively through REAL UI buttons + check real DB persistence for EVERY interaction!
    const processedNames = [];
    for (let step = 0; step < 10; step++) {
      await wait(400);
      const state = await evalJs(`(() => {
        const heading = document.querySelector('[data-testid="candidate-heading"]')?.textContent || '';
        const imgs = Array.from(document.querySelectorAll('img')).map(i => ({ complete: i.complete, nw: i.naturalWidth, src: i.src }));
        const txt = document.body.innerText;
        return { heading, imgs, txt };
      })()`);

      if (!state.heading) break;
      assert.equal(state.txt.includes(', null'), false, 'Browser UI must never show , null');
      assert.equal(state.txt.includes('18+ Student'), false, 'Browser UI must never show 18+ Student');

      // Check rendered portrait image loaded cleanly from signed local S3 URL!
      const loadedCardImg = state.imgs.some((i) => i.complete && i.nw > 0);
      assert.ok(loadedCardImg, `Portrait <img> failed to decode/render cleanly for "${state.heading}": ${JSON.stringify(state.imgs)}`);
      processedNames.push(state.heading);

      if (state.heading.startsWith('Meera HEIC')) {
        // Verify Full Profile modal also loads decoded HEIC->JPEG image cleanly!
        await evalJs(`document.querySelector('[data-testid="open-full-profile-btn"]')?.click()`);
        await wait(500);
        const modalImgsOk = await evalJs(`Array.from(document.querySelectorAll('[data-testid="full-profile-modal"] img')).every(i => i.complete && i.naturalWidth > 0)`);
        assert.ok(modalImgsOk, 'Full Profile modal failed to render HEIC->JPEG converted image');
        await cdp.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) =>
          fs.writeFileSync(path.join(AUDIT_SCREENSHOT_DIR, '15_real_db_heic_full_profile.png'), Buffer.from(data, 'base64')),
        );
        await evalJs(`document.querySelector('[aria-label="Close dialog"]')?.click()`);
        await wait(250);
        await evalJs(`document.querySelector('[data-testid="pass-btn"]')?.click()`);
      } else if (state.heading.startsWith('Siddharth Stale')) {
        // Post-feed mutation: pause Siddharth in PostgreSQL while card is rendered, then click Like!
        await prisma.profile.update({
          where: { id: candStale.profile.id },
          data: { isPaused: true, profileStatus: 'paused' },
        });
        await evalJs(`document.querySelector('[data-testid="like-btn"]')?.click()`);
        await wait(600);
        const staleNotice = await evalJs(`document.body.innerText`);
        assert.ok(staleNotice.includes('unavailable') || staleNotice.includes('paused'), 'Stale paused target should trigger clean unavailable notice');
      } else if (state.heading.startsWith('Kavya Mutual')) {
        await evalJs(`document.querySelector('[data-testid="like-btn"]')?.click()`);
        await wait(600);
        const modalText = await evalJs(`document.body.innerText`);
        assert.ok(modalText.includes('It is a mutual match'), 'Reciprocal like must open Mutual Match modal');
        await evalJs(`document.querySelector('[aria-label="Close dialog"]')?.click()`);
      } else if (state.heading.startsWith('Dev Block')) {
        await evalJs(`document.querySelector('[data-testid="block-open-btn"]')?.click()`);
        await wait(300);
        await evalJs(`document.querySelector('[data-testid="confirm-block-btn"]')?.click()`);
      } else if (state.heading.startsWith('Nisha Pass')) {
        await evalJs(`document.querySelector('[data-testid="pass-btn"]')?.click()`);
      } else {
        await evalJs(`document.querySelector('[data-testid="like-btn"]')?.click()`);
      }
      await wait(500);
    }

    assert.equal(processedNames.length, 7, `Expected all 7 valid DB candidates processed in browser UI, got ${processedNames.length}: ${processedNames.join(' | ')}`);

    console.log('5. Verifying final PostgreSQL persistence invariants (MATCH-10, Passes, Blocks, Reload suppression)...');
    const uniLikes = await prisma.like.findMany({ where: { fromAccountId: viewer.account.id, toAccountId: candUni.account.id } });
    assert.equal(uniLikes.length, 1, 'Unilateral Like persisted');
    const uniMatch = await prisma.match.findFirst({ where: { OR: [{ userLowId: viewer.account.id, userHighId: candUni.account.id }, { userLowId: candUni.account.id, userHighId: viewer.account.id }] } });
    assert.equal(uniMatch, null, 'Unilateral Like MUST NEVER create a Match');

    const [kLow, kHigh] = [viewer.account.id, candMutual.account.id].sort();
    const mutualMatch = await prisma.match.findUnique({
      where: { userLowId_userHighId: { userLowId: kLow, userHighId: kHigh } },
      include: { conversation: { include: { members: true } } },
    });
    assert.ok(mutualMatch && mutualMatch.status === 'active', 'Reciprocal Like created 1 active Match');
    assert.ok(mutualMatch.conversation && mutualMatch.conversation.status === 'active', 'Active Conversation created after Match');
    assert.equal(mutualMatch.conversation.members.length, 2, 'Both ConversationMembers persisted for Match');

    // Verify stale paused candidate was NOT liked
    const staleLike = await prisma.like.findFirst({ where: { fromAccountId: viewer.account.id, toAccountId: candStale.account.id } });
    assert.equal(staleLike, null, 'Stale paused target MUST NOT receive a Like');

    // Verify Pass persisted with ~30 day cooldown & empty pool after reload
    const passRow = await prisma.pass.findUnique({ where: { fromAccountId_toAccountId: { fromAccountId: viewer.account.id, toAccountId: candPass.account.id } } });
    assert.ok(passRow && passRow.expiresAt > new Date(), 'Pass cooldown persisted in PostgreSQL');

    const blockRow = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.account.id, blockedId: candBlock.account.id } } });
    assert.ok(blockRow, 'Block persisted in PostgreSQL');

    await cdp.send('Page.reload');
    await wait(1200);
    const afterReloadText = await evalJs(`document.body.innerText`);
    assert.ok(afterReloadText.includes('No more verified peers match right now'), 'Reloading Discover keeps passed/liked/blocked candidates excluded cleanly');

    const jsErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
    assert.equal(jsErrors.length, 0, 'Uncaught browser JS exceptions occurred');

    console.log('REAL_E2E_INTEGRATION_ALL_PASSED:', processedNames);
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
  console.error('REAL INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
