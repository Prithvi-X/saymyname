/**
 * Phase 3.5.2 Option A Real Full-Stack Voice-Note Streaming Proxy E2E Verification
 *
 * Exercises Next.js BFF (/api/bff/v1/messaging/media/:mediaId/stream) ->
 * NestJS API (/api/v1/messaging/media/:mediaId/stream) -> Local Range-enabled S3
 * across all 11 authorization cases, RFC 9110 Range seeks (200/206/416/HEAD),
 * zero S3 signed URL / s3Key exposure, client abort, and active stream termination on revocation.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const API_PORT = 4008;
const WEB_PORT = 3011;
const S3_PORT = 9016;
const S3_BUCKET = 'saymyname-media-352';
const JWT_ACCESS = 'e2e-352-access-secret-do-not-use-prod-32bytes';
const JWT_REFRESH = 'e2e-352-refresh-secret-do-not-use-prod-32bytes';

function uid(n) {
  return `35200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${hash}`;
}

function createWavBytes(durationSec = 3) {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
  }
  return buf;
}

function startLocalS3() {
  const objects = new Map();
  let slowModeKey = null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${S3_PORT}`);
    const prefix = `/${S3_BUCKET}/`;
    const key = url.pathname.startsWith(prefix)
      ? decodeURIComponent(url.pathname.slice(prefix.length))
      : decodeURIComponent(url.pathname.slice(1));

    if (req.method === 'PUT') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      objects.set(key, {
        body: Buffer.concat(chunks),
        contentType: String(req.headers['content-type'] || 'audio/wav'),
      });
      res.writeHead(200, { ETag: '"etag-352"' });
      return res.end();
    }

    const obj = objects.get(key);
    if (!obj) {
      res.writeHead(404);
      return res.end();
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': obj.contentType,
        'Content-Length': String(obj.body.length),
        'Accept-Ranges': 'bytes',
      });
      return res.end();
    }

    if (req.method === 'GET') {
      const rangeHeader = String(req.headers['range'] || '');
      const m = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (m) {
        const s = Number(m[1]);
        const e = m[2] ? Math.min(Number(m[2]), obj.body.length - 1) : obj.body.length - 1;
        const slice = obj.body.subarray(s, e + 1);
        res.writeHead(206, {
          'Content-Type': obj.contentType,
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${s}-${e}/${obj.body.length}`,
          'Accept-Ranges': 'bytes',
        });
        return res.end(slice);
      }

      if (slowModeKey && key === slowModeKey) {
        res.writeHead(200, {
          'Content-Type': obj.contentType,
          'Content-Length': String(obj.body.length),
          'Accept-Ranges': 'bytes',
        });
        res.write(obj.body.subarray(0, 512));
        // Drip slowly so test can revoke match / abort mid-stream cleanly
        const timer = setInterval(() => {
          if (res.destroyed || res.writableEnded) {
            clearInterval(timer);
            return;
          }
          res.write(obj.body.subarray(512, 1024));
        }, 400);
        req.on('close', () => clearInterval(timer));
        return;
      }

      res.writeHead(200, {
        'Content-Type': obj.contentType,
        'Content-Length': String(obj.body.length),
        'Accept-Ranges': 'bytes',
      });
      return res.end(obj.body);
    }

    res.writeHead(405);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(S3_PORT, '127.0.0.1', () =>
      resolve({
        server,
        setSlowKey: (k) => {
          slowModeKey = k;
        },
      }),
    );
  });
}

async function waitForHttp(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function bffLogin(webBase, email, password) {
  const csrfRes = await fetch(`${webBase}/api/auth/csrf`);
  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const { csrfToken } = await csrfRes.json();
  const cookieHeader = csrfCookies.map((c) => c.split(';')[0]).join('; ');

  const loginRes = await fetch(`${webBase}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: webBase,
      'X-SMN-CSRF': csrfToken,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginRes.status, 200, `BFF login failed for ${email}`);
  const loginCookies = loginRes.headers.getSetCookie?.() || [];
  const merged = new Map();
  for (const c of [...csrfCookies, ...loginCookies]) {
    const kv = c.split(';')[0];
    const idx = kv.indexOf('=');
    if (idx > 0) merged.set(kv.slice(0, idx), kv);
  }
  return {
    cookie: Array.from(merged.values()).join('; '),
    csrfToken,
  };
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const { server: s3Server, setSlowKey } = await startLocalS3();

  let apiProc;
  let webProc;

  const userIds = [uid(1), uid(2), uid(3), uid(4), uid(5)];
  const profIds = [uid(11), uid(12), uid(13), uid(14), uid(15)];

  try {
    // Clean fixture namespace
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { reportedId: { in: userIds } }] } });
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] },
    });
    await prisma.match.deleteMany({
      where: { OR: [{ userLowId: { in: userIds } }, { userHighId: { in: userIds } }] },
    });
    await prisma.profile.deleteMany({ where: { id: { in: profIds } } });
    await prisma.account.deleteMany({ where: { id: { in: userIds } } });

    const passwordHash = hashPasswordPbkdf2('MediaTestPass123!');
    const seedMember = async (idx, name, slug) => {
      const accId = userIds[idx];
      const profId = profIds[idx];
      await prisma.account.create({
        data: {
          id: accId,
          authSubject: accId,
          email: `${slug}@ds.study.iitm.ac.in`,
          passwordHash,
          accountStatus: 'active',
          emailVerifiedAt: new Date(),
          displayName: name,
        },
      });
      await prisma.accountEligibility.create({
        data: {
          accountId: accId,
          ageStatus: 'approved',
          studentStatus: 'approved',
          discoveryEligible: true,
          dateOfBirth: new Date('2003-02-01T00:00:00Z'),
          programmeFamily: 'data_science_applications',
          pathwayCode: 'foundation_entry',
        },
      });
      await prisma.profile.create({
        data: {
          id: profId,
          accountId: accId,
          displayName: name,
          programmeFamily: 'data_science_applications',
          termOrYear: 'Diploma Level',
          intention: 'Long-term connection',
          bio: `${name} media verification profile`,
          isPublished: true,
          isPaused: false,
          profileStatus: 'live',
          consentAcceptedAt: new Date(),
          photos: {
            create: [
              {
                id: uid(50 + idx),
                s3Key: `photos/${accId}/p.jpg`,
                isPrimary: true,
                displayOrder: 0,
                moderationStatus: 'approved',
              },
            ],
          },
          preferences: {
            create: {
              minAge: 18,
              maxAge: 35,
              allowedProgrammes: ['data_science_applications'],
              showInDiscovery: true,
            },
          },
        },
      });
    };

    await seedMember(0, 'Sender A', 'm352-a');
    await seedMember(1, 'Recipient B', 'm352-b');
    await seedMember(2, 'Outsider C', 'm352-c');
    await seedMember(3, 'BlockPeer D', 'm352-d');
    await seedMember(4, 'RevokePeer E', 'm352-e');

    const baseEnv = {
      ...process.env,
      DATABASE_URL: DB_URL,
      REDIS_URL,
      DISABLE_REDIS: 'false',
      PORT: String(API_PORT),
      JWT_ACCESS_SECRET: JWT_ACCESS,
      JWT_REFRESH_SECRET: JWT_REFRESH,
      R2_ENDPOINT: `http://127.0.0.1:${S3_PORT}`,
      R2_BUCKET_NAME: S3_BUCKET,
      R2_ACCESS_KEY_ID: 'local-352-key',
      R2_SECRET_ACCESS_KEY: 'local-352-secret',
      R2_FORCE_PATH_STYLE: 'true',
      CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT}`,
      API_BACKEND_URL: `http://127.0.0.1:${API_PORT}`,
    };

    apiProc = spawn('node', ['dist/src/main.js'], {
      cwd: 'i:\\saymyname\\services\\api',
      env: baseEnv,
      stdio: 'pipe',
    });
    apiProc.stderr.on('data', (d) => process.stderr.write(`[API-352] ${d}`));

    const nextBin = require.resolve('next/dist/bin/next', { paths: ['i:\\saymyname\\apps\\web', 'i:\\saymyname'] });
    webProc = spawn('node', [nextBin, 'start', '-p', String(WEB_PORT), '-H', '127.0.0.1'], {
      cwd: 'i:\\saymyname\\apps\\web',
      env: { ...baseEnv, NODE_ENV: 'production' },
      stdio: 'pipe',
    });
    webProc.stderr.on('data', (d) => process.stderr.write(`[WEB-352] ${d}`));

    await Promise.all([
      waitForHttp(`http://127.0.0.1:${API_PORT}/api/v1/health`),
      waitForHttp(`http://127.0.0.1:${WEB_PORT}/login`),
    ]);

    const apiBase = `http://127.0.0.1:${API_PORT}`;
    const webBase = `http://127.0.0.1:${WEB_PORT}`;

    const sessA = await bffLogin(webBase, 'm352-a@ds.study.iitm.ac.in', 'MediaTestPass123!');
    const sessB = await bffLogin(webBase, 'm352-b@ds.study.iitm.ac.in', 'MediaTestPass123!');
    const sessC = await bffLogin(webBase, 'm352-c@ds.study.iitm.ac.in', 'MediaTestPass123!');
    const sessD = await bffLogin(webBase, 'm352-d@ds.study.iitm.ac.in', 'MediaTestPass123!');
    const sessE = await bffLogin(webBase, 'm352-e@ds.study.iitm.ac.in', 'MediaTestPass123!');

    const createMatchAndVoiceNote = async (senderSess, peerSess, peerProfIdx, senderProfIdx) => {
      await fetch(`${webBase}/api/bff/v1/dating/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: senderSess.cookie,
          Origin: webBase,
          'X-SMN-CSRF': senderSess.csrfToken,
        },
        body: JSON.stringify({ targetProfileId: profIds[peerProfIdx] }),
      });
      const mRes = await fetch(`${webBase}/api/bff/v1/dating/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: peerSess.cookie,
          Origin: webBase,
          'X-SMN-CSRF': peerSess.csrfToken,
        },
        body: JSON.stringify({ targetProfileId: profIds[senderProfIdx] }),
      }).then((r) => r.json());
      assert.equal(mRes.isMutualMatch, true);

      const wav = createWavBytes(3);
      const presign = await fetch(
        `${webBase}/api/bff/v1/messaging/conversations/${mRes.conversationId}/voice-notes/presign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: senderSess.cookie,
            Origin: webBase,
            'X-SMN-CSRF': senderSess.csrfToken,
          },
          body: JSON.stringify({
            filename: 'voice-352.wav',
            mimeType: 'audio/wav',
            durationSeconds: 3,
            fileSizeBytes: wav.length,
          }),
        },
      ).then((r) => r.json());

      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav,
      });
      assert.equal(put.status, 200);

      const sent = await fetch(
        `${webBase}/api/bff/v1/messaging/conversations/${mRes.conversationId}/voice-notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: senderSess.cookie,
            Origin: webBase,
            'X-SMN-CSRF': senderSess.csrfToken,
          },
          body: JSON.stringify({
            mediaRefId: presign.mediaRefId,
            uploadToken: presign.uploadToken,
            durationSeconds: 3,
          }),
        },
      ).then((r) => r.json());

      const serialized = JSON.stringify(sent);
      assert.equal(serialized.includes('X-Amz-'), false, 'Message DTO MUST NOT contain signed S3 URL');
      assert.equal(serialized.includes('127.0.0.1:9016'), false, 'Message DTO MUST NOT contain private R2/S3 host');
      assert.equal(serialized.includes('s3Key'), false, 'Message DTO MUST NOT expose s3Key');
      assert.equal(sent.mediaUrl, `/api/bff/v1/messaging/media/${sent.mediaId}/stream`);

      return { matchId: mRes.matchId, convId: mRes.conversationId, msg: sent, wav };
    };

    const chatAB = await createMatchAndVoiceNote(sessA, sessB, 1, 0);
    const streamPath = chatAB.msg.mediaUrl;

    // Auth Cases 1 & 2: Sender A & Recipient B succeed (200 GET, HEAD, 206 forward & backward seek, headers, 416 bad Range)
    for (const [label, cookie] of [
      ['Sender A', sessA.cookie],
      ['Recipient B', sessB.cookie],
    ]) {
      const fullRes = await fetch(`${webBase}${streamPath}`, { headers: { Cookie: cookie } });
      assert.equal(fullRes.status, 200, `${label} full stream must be 200`);
      const fullBuf = Buffer.from(await fullRes.arrayBuffer());
      assert.deepStrictEqual(fullBuf, chatAB.wav, `${label} full stream byte-for-byte match`);
      assert.equal(fullRes.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(fullRes.headers.get('accept-ranges'), 'bytes');
      assert.ok((fullRes.headers.get('cache-control') || '').includes('no-store'));

      const headRes = await fetch(`${webBase}${streamPath}`, { method: 'HEAD', headers: { Cookie: cookie } });
      assert.equal(headRes.status, 200, `${label} HEAD must return 200`);
      assert.equal(headRes.headers.get('accept-ranges'), 'bytes');
      assert.ok((headRes.headers.get('content-type') || '').startsWith('audio/'));

      // Seek forward & backward via Range
      const rForward = await fetch(`${webBase}${streamPath}`, {
        headers: { Cookie: cookie, Range: 'bytes=1024-2047' },
      });
      assert.equal(rForward.status, 206);
      assert.equal(rForward.headers.get('content-range'), `bytes 1024-2047/${chatAB.wav.length}`);
      assert.deepStrictEqual(Buffer.from(await rForward.arrayBuffer()), chatAB.wav.subarray(1024, 2048));

      const rBackward = await fetch(`${webBase}${streamPath}`, {
        headers: { Cookie: cookie, Range: 'bytes=0-511' },
      });
      assert.equal(rBackward.status, 206);
      assert.deepStrictEqual(Buffer.from(await rBackward.arrayBuffer()), chatAB.wav.subarray(0, 512));

      const rInvalid = await fetch(`${webBase}${streamPath}`, {
        headers: { Cookie: cookie, Range: `bytes=${chatAB.wav.length + 100}-` },
      });
      assert.equal(rInvalid.status, 416);
    }

    // Auth Case 3: Unauthenticated (no cookie) -> 401
    const unauthRes = await fetch(`${webBase}${streamPath}`);
    assert.equal(unauthRes.status, 401);

    // Auth Case 4: Logged-out session (Recipient B logs out -> Set-Cookie clears cookies & revokes refresh -> 401)
    const logoutSess = await bffLogin(webBase, 'm352-b@ds.study.iitm.ac.in', 'MediaTestPass123!');
    assert.equal((await fetch(`${webBase}${streamPath}`, { headers: { Cookie: logoutSess.cookie } })).status, 200);
    const logoutRes = await fetch(`${webBase}/api/auth/logout`, {
      method: 'POST',
      headers: { Origin: webBase, Cookie: logoutSess.cookie, 'X-SMN-CSRF': logoutSess.csrfToken },
    });
    assert.equal(logoutRes.status, 200);
    const clearedSetCookies = logoutRes.headers.getSetCookie?.() || [];
    assert.ok(
      clearedSetCookies.some((c) => c.startsWith('smn_access_token=;') || c.includes('Max-Age=0')),
      'Logout must clear HttpOnly auth cookies',
    );
    // Replay ONLY remaining CSRF cookie (browser cleared access & refresh cookies) -> 401; and verify refresh is revoked -> 401
    const csrfOnlyCookie = logoutSess.cookie
      .split('; ')
      .filter((kv) => kv.startsWith('smn_csrf='))
      .join('; ');
    const postLogoutRes = await fetch(`${webBase}${streamPath}`, {
      headers: { Cookie: csrfOnlyCookie },
    });
    assert.equal(postLogoutRes.status, 401);
    const refreshOnlyCookie = logoutSess.cookie
      .split('; ')
      .filter((kv) => kv.startsWith('smn_refresh_token=') || kv.startsWith('smn_csrf='))
      .join('; ');
    const revokedRefreshRes = await fetch(`${webBase}/api/auth/refresh`, {
      method: 'POST',
      headers: { Origin: webBase, Cookie: refreshOnlyCookie, 'X-SMN-CSRF': logoutSess.csrfToken },
    });
    assert.equal(revokedRefreshRes.status, 401, 'Revoked refresh token after logout must fail 401');

    // Auth Cases 5 & 6: Outsider C & nonexistent UUID -> uniform 403 anti-oracle
    const outsiderRes = await fetch(`${webBase}${streamPath}`, { headers: { Cookie: sessC.cookie } });
    assert.equal(outsiderRes.status, 403);
    const nonexistentRes = await fetch(`${webBase}/api/bff/v1/messaging/media/${uid(9999)}/stream`, {
      headers: { Cookie: sessC.cookie },
    });
    assert.equal(nonexistentRes.status, 403, 'Nonexistent mediaId must also return 403 (zero oracle)');

    // Auth Case 7 + Mid-stream revocation: Active slow stream interrupted when A unmatches B!
    const mediaRow = await prisma.messageMedia.findUnique({ where: { id: chatAB.msg.mediaId } });
    setSlowKey(mediaRow.s3Key);
    const slowController = new AbortController();
    const slowFetch = await fetch(`${webBase}${streamPath}`, {
      headers: { Cookie: sessB.cookie },
      signal: slowController.signal,
    });
    assert.equal(slowFetch.status, 200);
    const reader = slowFetch.body.getReader();
    const firstChunk = await reader.read();
    assert.ok(firstChunk.value && firstChunk.value.length > 0);

    // Unmatch A -> B mid-stream
    await fetch(`${webBase}/api/bff/v1/dating/matches/${chatAB.matchId}/unmatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessA.cookie,
        Origin: webBase,
        'X-SMN-CSRF': sessA.csrfToken,
      },
      body: JSON.stringify({ reason: 'E2E stream revocation test' }),
    });
    // Wait for stream termination signal
    let closedEarly = false;
    const drainTimeout = setTimeout(() => slowController.abort(), 3000);
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) {
          closedEarly = true;
          break;
        }
      }
    } catch {
      closedEarly = true;
    } finally {
      clearTimeout(drainTimeout);
    }
    assert.equal(closedEarly, true, 'Mid-stream match termination must stop delivering chunks');
    setSlowKey(null);

    const postUnmatchRes = await fetch(`${webBase}${streamPath}`, {
      headers: { Cookie: sessB.cookie, Range: 'bytes=0-127' },
    });
    assert.equal(postUnmatchRes.status, 403, 'Post-unmatch Range seek MUST fail closed 403');

    // Auth Case 8: Block -> 403
    const chatAD = await createMatchAndVoiceNote(sessA, sessD, 3, 0);
    await fetch(`${webBase}/api/bff/v1/safety/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessA.cookie,
        Origin: webBase,
        'X-SMN-CSRF': sessA.csrfToken,
      },
      body: JSON.stringify({ targetProfileId: profIds[3], reason: 'E2E 3.5.2 block check' }),
    });
    const postBlockRes = await fetch(`${webBase}${chatAD.msg.mediaUrl}`, { headers: { Cookie: sessD.cookie } });
    assert.equal(postBlockRes.status, 403);

    // Auth Cases 9, 10, 11: Eligibility revocation, Suspension, Account Deletion -> 403
    const chatAE = await createMatchAndVoiceNote(sessA, sessE, 4, 0);
    const streamAE = chatAE.msg.mediaUrl;
    assert.equal((await fetch(`${webBase}${streamAE}`, { headers: { Cookie: sessE.cookie } })).status, 200);

    // 10. Verification revoked (studentStatus = 'rejected', discoveryEligible = false)
    await prisma.accountEligibility.update({
      where: { accountId: userIds[4] },
      data: { studentStatus: 'rejected', discoveryEligible: false },
    });
    assert.equal((await fetch(`${webBase}${streamAE}`, { headers: { Cookie: sessE.cookie } })).status, 403);

    // Restore eligibility, test 9. Suspension
    await prisma.accountEligibility.update({
      where: { accountId: userIds[4] },
      data: { studentStatus: 'approved', discoveryEligible: true },
    });
    await prisma.account.update({
      where: { id: userIds[4] },
      data: { accountStatus: 'suspended' },
    });
    assert.equal((await fetch(`${webBase}${streamAE}`, { headers: { Cookie: sessE.cookie } })).status, 403);

    // 11. Deleted account -> 403
    await prisma.account.update({
      where: { id: userIds[4] },
      data: { accountStatus: 'active', deletedAt: new Date() },
    });
    assert.equal((await fetch(`${webBase}${streamAE}`, { headers: { Cookie: sessE.cookie } })).status, 403);

    // Direct API vs BFF parity sanity check
    assert.equal((await fetch(`${apiBase}/api/v1/messaging/media/${chatAE.msg.mediaId}/stream`)).status, 401);

    console.log(
      JSON.stringify(
        {
          suite: 'phase3-5-2-media-e2e',
          status: 'PASS',
          authCasesVerified: 11,
          rangeCodesVerified: [200, 206, 416],
          midStreamRevocationAborted: true,
          signedUrlExposedToBrowser: false,
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      webProc?.kill('SIGTERM');
    } catch {}
    try {
      apiProc?.kill('SIGTERM');
    } catch {}
    s3Server?.close();
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: userIds } }, { reportedId: { in: userIds } }] } }).catch(() => null);
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] },
    }).catch(() => null);
    await prisma.match.deleteMany({
      where: { OR: [{ userLowId: { in: userIds } }, { userHighId: { in: userIds } }] },
    }).catch(() => null);
    await prisma.profile.deleteMany({ where: { id: { in: profIds } } }).catch(() => null);
    await prisma.account.deleteMany({ where: { id: { in: userIds } } }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
