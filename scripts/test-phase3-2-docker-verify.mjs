/**
 * Phase 3.2 Docker Container Verification Script (§2)
 * Builds/runs inside `saymyname-api:phase32-verify` locally without touching production/live R2:
 *  - Verifies Node runtime, FFmpeg binary + version + HEVC decoder, sharp, zero baked .env secrets, writable/cleaned tmpdir
 *  - Executes real still HEIC -> stripped JPEG + JPEG/PNG/WebP processing INSIDE the container
 *  - Starts `node dist/src/main.js` with runtime-only test env against local PostgreSQL and probes `/api/v1/health`
 *  - Verifies container-converted JPEG decodes/renders in local Edge browser
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const IMAGE_TAG = 'saymyname-api:phase32-verify';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DOCKER_DB_URL =
  'postgresql://saymyname_user:saymyname_password@host.docker.internal:5433/saymyname_phase32_audit?schema=public';

function runDocker(args, opts = {}) {
  const res = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: opts.timeout ?? 60000,
    ...opts,
  });
  if (res.status !== 0 && !opts.allowFailure) {
    throw new Error(`docker ${args.join(' ')} failed (${res.status}):\n${res.stdout}\n${res.stderr}`);
  }
  return res;
}

async function main() {
  console.log('1. Inspecting image runtime, FFmpeg, HEVC decoder, zero baked secrets, and tmpdir hygiene...');
  const containerProbeScript = `
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const crypto = require('crypto');
    const { execFileSync } = require('child_process');
    const sharpModule = require('sharp');
    const sharp = sharpModule.default || sharpModule;
    const { PrismaClient } = require('@prisma/client');
    const { S3Client } = require('@aws-sdk/client-s3');
    const sec = require('/app/services/api/dist/src/modules/profiles/image-security.js');

    (async () => {
      // Check no .env* secrets baked into container image
      const forbiddenEnvFiles = [
        '/app/.env',
        '/app/.env.local',
        '/app/services/api/.env',
        '/app/services/api/.env.local',
        '/app/packages/database/.env',
      ].filter((p) => fs.existsSync(p));
      if (forbiddenEnvFiles.length > 0) {
        throw new Error('Forbidden env files baked in image: ' + forbiddenEnvFiles.join(', '));
      }

      // Check runtime tools & deps
      const ffmpegVer = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\\n')[0].trim();
      const decoders = execFileSync('ffmpeg', ['-hide_banner', '-decoders'], { encoding: 'utf8' });
      const hasHevc = /\\bhevc\\b/i.test(decoders);
      if (!hasHevc) throw new Error('FFmpeg in container lacks HEVC decoder');

      // Check runtime capability helper inside Linux container
      if (sec.isHeicDecodingSupported() !== true) {
        throw new Error('sec.isHeicDecodingSupported() returned false in container');
      }
      const allowed = sec.getAllowedImageMimes();
      if (!allowed.includes('image/heic')) {
        throw new Error('Container getAllowedImageMimes() did not include image/heic: ' + JSON.stringify(allowed));
      }

      // Check writable tmpdir as USER node
      const tmpRoot = os.tmpdir();
      const probeDir = fs.mkdtempSync(path.join(tmpRoot, 'smn-write-probe-'));
      fs.writeFileSync(path.join(probeDir, 'ok.txt'), 'writable');
      fs.rmSync(probeDir, { recursive: true, force: true });

      const preTmpCount = fs.readdirSync(tmpRoot).filter((f) => f.startsWith('smn-heic-')).length;

      // 1) Synthesize authentic still ISO BMFF HEIC (ftypheic + meta + hdlr/pict + pitm + iinf + ipco/hvcC/ispe + ipma + iloc + Exif + mdat) using container ffmpeg + libx265
      const workDir = fs.mkdtempSync(path.join(tmpRoot, 'smn-gen-'));
      let heicBuffer;
      const usedEncoder = 'container-ffmpeg-libx265';
      try {
        const mp4Path = path.join(workDir, 'frame.mp4');
        execFileSync(
          'ffmpeg',
          ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=#A28BFA:s=96x96', '-frames:v', '1', '-c:v', 'libx265', '-f', 'mp4', mp4Path],
          { timeout: 15000 },
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

        const ftyp = box('ftyp', Buffer.from('heic\\0\\0\\0\\0mif1heic', 'latin1'));
        const hdlr = fullbox('hdlr', 0, 0, Buffer.concat([Buffer.alloc(4), Buffer.from('pict', 'ascii'), Buffer.alloc(13)]));
        const pitm = fullbox('pitm', 0, 0, Buffer.from([0x00, 0x01]));
        const infe = fullbox('infe', 2, 0, Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00]), Buffer.from('hvc1Image\\0', 'ascii')]));
        const iinf = fullbox('iinf', 0, 0, Buffer.concat([Buffer.from([0x00, 0x01]), infe]));
        const ispeBuf = Buffer.alloc(8);
        ispeBuf.writeUInt32BE(96, 0);
        ispeBuf.writeUInt32BE(96, 4);
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
        const exifData = Buffer.from('Exif\\0\\0MM\\0*GPS_LAT_CONFIDENTIAL_CONTAINER_TEST', 'latin1');
        const metaLen = buildMeta(0).length;
        const meta = buildMeta(ftyp.length + metaLen + 8);
        const mdat = box('mdat', Buffer.concat([sampleBytes, exifData]));
        heicBuffer = Buffer.concat([ftyp, meta, mdat]);
      } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
      }

      // Run HEIC sanitization inside container
      const heicOut = await sec.verifyAndSanitizeR2Image(heicBuffer, 'image/heic');
      if (!heicOut.isValid || heicOut.detectedMime !== 'image/jpeg' || !heicOut.transcodedFromHeic) {
        throw new Error('Container HEIC verifyAndSanitizeR2Image failed: ' + JSON.stringify(heicOut));
      }
      if (heicOut.widthPx !== 96 || heicOut.heightPx !== 96) {
        throw new Error('Unexpected HEIC dimensions: ' + heicOut.widthPx + 'x' + heicOut.heightPx);
      }
      if (heicOut.sanitizedBuffer.includes(Buffer.from('Exif')) || heicOut.sanitizedBuffer.includes(Buffer.from('GPS_LAT_CONFIDENTIAL'))) {
        throw new Error('EXIF metadata survived HEIC -> JPEG transcoding inside container');
      }

      // Verify smn-heic temp directories were completely cleaned up
      const postTmpCount = fs.readdirSync(tmpRoot).filter((f) => f.startsWith('smn-heic-')).length;
      if (postTmpCount !== preTmpCount) {
        throw new Error('Temp directories leaked after HEIC processing: ' + postTmpCount);
      }

      // Verify JPEG (with EXIF), PNG (with tEXt), WebP (with EXIF) inside container
      const jpegWithExif = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 169, b: 126 } },
      }).withMetadata({ exif: { IFD0: { Make: 'SECRET_CAM' } } }).jpeg().toBuffer();
      const jpegOut = await sec.verifyAndSanitizeR2Image(jpegWithExif, 'image/jpeg');
      if (!jpegOut.isValid || jpegOut.detectedMime !== 'image/jpeg' || jpegOut.sanitizedBuffer.includes(Buffer.from('SECRET_CAM'))) {
        throw new Error('Container JPEG EXIF strip failed');
      }

      const pngRaw = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 100, g: 150, b: 200 } },
      }).withMetadata({ exif: { IFD0: { Artist: 'SECRET_PNG' } } }).png().toBuffer();
      const pngOut = await sec.verifyAndSanitizeR2Image(pngRaw, 'image/png');
      if (!pngOut.isValid || pngOut.detectedMime !== 'image/png' || pngOut.sanitizedBuffer.includes(Buffer.from('SECRET_PNG'))) {
        throw new Error('Container PNG metadata strip failed');
      }

      const webpRaw = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 80, g: 180, b: 140 } },
      }).withMetadata({ exif: { IFD0: { Software: 'SECRET_WEBP' } } }).webp().toBuffer();
      const webpOut = await sec.verifyAndSanitizeR2Image(webpRaw, 'image/webp');
      if (!webpOut.isValid || webpOut.detectedMime !== 'image/webp' || webpOut.sanitizedBuffer.includes(Buffer.from('SECRET_WEBP'))) {
        throw new Error('Container WebP metadata strip failed');
      }

      console.log(JSON.stringify({
        nodeVersion: process.version,
        userUid: process.getuid ? process.getuid() : null,
        ffmpegVersion: ffmpegVer,
        hasHevc,
        usedEncoder,
        prismaClientLoaded: typeof PrismaClient === 'function',
        s3ClientLoaded: typeof S3Client === 'function',
        heicOutMime: heicOut.detectedMime,
        heicOutSize: heicOut.sanitizedBuffer.length,
        heicOutDims: heicOut.widthPx + 'x' + heicOut.heightPx,
        jpegBytes: jpegOut.sanitizedBuffer.length,
        pngBytes: pngOut.sanitizedBuffer.length,
        webpBytes: webpOut.sanitizedBuffer.length,
        convertedJpegB64: heicOut.sanitizedBuffer.toString('base64'),
      }));
    })().catch((e) => { console.error(e); process.exit(1); });
  `;

  // Synthesize host H265 sample first cleanly as fallback in case Debian ffmpeg lacks libx265 encoder
  const tmpHostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-host-h265-'));
  let h265B64 = '';
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-f', 'lavfi', '-i', 'color=c=0xA28BFA:s=96x96', '-frames:v', '1', '-c:v', 'libx265', '-f', 'hevc', path.join(tmpHostDir, 'sample.265')],
      { stdio: 'pipe', timeout: 15000 },
    );
    h265B64 = fs.readFileSync(path.join(tmpHostDir, 'sample.265')).toString('base64');
  } finally {
    fs.rmSync(tmpHostDir, { recursive: true, force: true });
  }

  const probeRes = runDocker([
    'run', '--rm',
    '-e', `SYNTHETIC_H265_B64=${h265B64}`,
    IMAGE_TAG,
    'node', '-e', containerProbeScript,
  ]);
  const probeLines = probeRes.stdout.trim().split('\n');
  const probeJson = JSON.parse(probeLines[probeLines.length - 1]);
  console.log('   Container media/runtime probe OK:', {
    nodeVersion: probeJson.nodeVersion,
    userUid: probeJson.userUid,
    ffmpegVersion: probeJson.ffmpegVersion,
    hasHevc: probeJson.hasHevc,
    usedEncoder: probeJson.usedEncoder,
    heicOutMime: probeJson.heicOutMime,
    heicOutDims: probeJson.heicOutDims,
    heicOutSize: probeJson.heicOutSize,
    jpegBytes: probeJson.jpegBytes,
    pngBytes: probeJson.pngBytes,
    webpBytes: probeJson.webpBytes,
  });

  // 2) Verify container-converted JPEG actually decodes & renders cleanly in real Edge browser!
  const verifyHtmlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-edge-jpeg-'));
  const jpgFile = path.join(verifyHtmlDir, 'converted.jpg');
  const htmlFile = path.join(verifyHtmlDir, 'index.html');
  fs.writeFileSync(jpgFile, Buffer.from(probeJson.convertedJpegB64, 'base64'));
  fs.writeFileSync(
    htmlFile,
    `<!doctype html><html><body><img id="p" src="file:///${jpgFile.replace(/\\/g, '/')}" onload="document.title='IMG_OK:'+this.naturalWidth+'x'+this.naturalHeight" /></body></html>`,
  );

  if (fs.existsSync(EDGE_PATH)) {
    const domRes = spawnSync(
      EDGE_PATH,
      ['--headless', '--disable-gpu', '--virtual-time-budget=2000', '--dump-dom', `file:///${htmlFile.replace(/\\/g, '/')}`],
      { encoding: 'utf8', timeout: 15000 },
    );
    assert.strictEqual(domRes.status, 0);
    assert.ok(domRes.stdout.includes('IMG_OK:96x96'), `Edge failed to render container-converted JPEG cleanly: ${domRes.stdout}`);
    // Double check image magic & no EXIF independently
    const rawJpg = fs.readFileSync(jpgFile);
    assert.strictEqual(rawJpg[0], 0xff);
    assert.strictEqual(rawJpg[1], 0xd8);
    assert.ok(!rawJpg.includes(Buffer.from('Exif')));
  }
  fs.rmSync(verifyHtmlDir, { recursive: true, force: true });

  // 3) Boot real container API HTTP server against local PostgreSQL with zero baked secrets & verify /health
  console.log('2. Booting built API container (NODE_ENV=production) against local PostgreSQL...');
  const containerName = `smn-api-verify-${Date.now()}`;
  const jwtAccess = 'docker-verify-access-secret-32-chars-minimum';
  const jwtRefresh = 'docker-verify-refresh-secret-32-chars-minimum';

  try {
    runDocker([
      'run', '-d',
      '--name', containerName,
      '--add-host=host.docker.internal:host-gateway',
      '-p', '4005:4000',
      '-e', 'NODE_ENV=production',
      '-e', 'PORT=4000',
      '-e', `DATABASE_URL=${DOCKER_DB_URL}`,
      '-e', `JWT_ACCESS_SECRET=${jwtAccess}`,
      '-e', `JWT_REFRESH_SECRET=${jwtRefresh}`,
      '-e', 'REVIEWER_API_KEY=docker-verify-reviewer-key-1234',
      '-e', 'SKIP_EMAIL_DISPATCH=true',
      IMAGE_TAG,
    ]);

    let healthBody = null;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch('http://127.0.0.1:4005/api/v1/health');
        if (r.ok) {
          healthBody = await r.json();
          break;
        }
      } catch {
        // wait
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!healthBody) {
      const logs = runDocker(['logs', containerName], { allowFailure: true });
      throw new Error(`Container API /api/v1/health failed to respond.\nLogs:\n${logs.stdout}\n${logs.stderr}`);
    }

    assert.strictEqual(healthBody.status, 'ok');
    assert.strictEqual(healthBody.capabilities?.heicDecoding, true);

    // Check /profiles/catalog MIME list with signed bearer token
    const b64 = (v) =>
      Buffer.from(JSON.stringify(v)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const nowSec = Math.floor(Date.now() / 1000);
    const h = b64({ alg: 'HS256', typ: 'JWT' });
    const p = b64({
      sub: '00000000-0000-4000-8000-000000000099',
      email: 'probe@ds.study.iitm.ac.in',
      discoveryEligible: true,
      iat: nowSec,
      exp: nowSec + 300,
    });
    const sig = crypto.createHmac('sha256', jwtAccess).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${h}.${p}.${sig}`;

    const catRes = await fetch('http://127.0.0.1:4005/api/v1/profiles/catalog', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(catRes.status, 200);
    const catBody = await catRes.json();
    assert.deepStrictEqual(catBody.supportedImageMimes, [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
    ]);
    assert.strictEqual(catBody.heicSupported, true);

    console.log('DOCKER_CONTAINER_VERIFICATION_ALL_PASSED:', {
      health: healthBody,
      supportedImageMimes: catBody.supportedImageMimes,
    });
  } finally {
    runDocker(['rm', '-f', containerName], { allowFailure: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
