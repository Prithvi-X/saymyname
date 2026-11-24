/**
 * SayMyName — Isolated Staging Smoke Test (Resend Email + Private Cloudflare R2 Portrait)
 *
 * SAFETY DEFAULT (D-P2-05 / Exit Gate Task 4):
 * - Runs in DRY-RUN / PREFLIGHT validation mode by default.
 * - NEVER creates live test objects or spends Resend external quotas unless the operator
 *   explicitly passes `--confirm-live-quota` AND sets `ALLOW_LIVE_STAGING_SMOKE=true`.
 *
 * Usage (Dry-Run Preflight — zero external spend/objects):
 *   node scripts/smoke-staging-resend-r2.mjs
 *
 * Usage (Authorised Staging Smoke Execution — sends 1 OTP email + 1 temporary portrait & cleans up):
 *   ALLOW_LIVE_STAGING_SMOKE=true node scripts/smoke-staging-resend-r2.mjs --confirm-live-quota
 */
import assert from 'node:assert/strict';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const LIVE_CONFIRMED =
  process.argv.includes('--confirm-live-quota') &&
  process.env.ALLOW_LIVE_STAGING_SMOKE === 'true';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const REVIEWER_API_KEY = process.env.REVIEWER_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

const SMOKE_EMAIL = process.env.SMOKE_EMAIL || '';

// Minimal valid 1x1 JPEG bytes for isolated portrait upload test
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

function evaluateReadiness() {
  const checks = [
    { name: 'API_BASE configured', ok: Boolean(API_BASE) },
    { name: 'REVIEWER_API_KEY configured (>= 16 chars)', ok: REVIEWER_API_KEY.length >= 16 },
    { name: 'RESEND_API_KEY configured', ok: RESEND_API_KEY.startsWith('re_') || RESEND_API_KEY.length > 10 },
    { name: 'EMAIL_FROM configured', ok: EMAIL_FROM.includes('@') },
    { name: 'R2_ENDPOINT / R2_ACCOUNT_ID configured', ok: Boolean(R2_ENDPOINT) },
    { name: 'R2_BUCKET_NAME configured', ok: Boolean(R2_BUCKET_NAME) },
    { name: 'R2_ACCESS_KEY_ID & SECRET configured', ok: Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) },
    {
      name: 'SMOKE_EMAIL explicitly supplied (@*.study.iitm.ac.in test inbox)',
      ok: SMOKE_EMAIL.endsWith('study.iitm.ac.in'),
    },
  ];
  return checks;
}

async function runLiveSmoke() {
  console.log('=== EXECUTING ISOLATED STAGING LIVE SMOKE TEST (RESEND + R2) ===');

  const healthRes = await fetch(`${API_BASE}/health`);
  assert.equal(healthRes.status, 200, 'Staging API /health must return 200');
  console.log('[PASS] Staging API health reachable.');

  // 1. Real Resend OTP delivery via live /identity/register or /identity/resend-otp
  const smokePassword = `Smk-${Date.now()}-ValidPass!`;
  const regRes = await fetch(`${API_BASE}/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: SMOKE_EMAIL,
      password: smokePassword,
      displayName: 'Staging Smoke Probe',
    }),
  });
  const regJson = await regRes.json().catch(() => ({}));
  assert.ok([201, 409].includes(regRes.status), `Unexpected register status ${regRes.status}`);

  if (regRes.status === 201) {
    assert.equal(regJson.devOtp, undefined, 'Production/staging must NEVER expose devOtp');
    console.log('[PASS] Resend email dispatch accepted on /identity/register; devOtp strictly redacted.');
  } else {
    const resendRes = await fetch(`${API_BASE}/identity/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SMOKE_EMAIL }),
    });
    assert.ok([200, 429].includes(resendRes.status), `Resend returned ${resendRes.status}`);
    console.log('[PASS] Resend email dispatch / cooldown probe verified cleanly.');
  }

  // 2. Private Cloudflare R2 bucket isolation + presigned PUT + signed GET + short TTL expiry
  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  await s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
  console.log('[PASS] R2 HeadBucket succeeded with configured credentials.');

  const smokeKey = `smoke-test/portraits/${Date.now()}-isolated-probe.jpg`;
  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: smokeKey,
      ContentType: 'image/jpeg',
    }),
    { expiresIn: 120 },
  );

  const putResp = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: TINY_JPEG,
  });
  assert.equal(putResp.status, 200, 'Presigned R2 PUT portrait upload must succeed');
  console.log('[PASS] Private R2 portrait PUT via presigned URL succeeded.');

  // Verify unauthenticated public URL access (if custom/endpoint queried unsigned) is denied
  const unsignedGet = await fetch(`${R2_ENDPOINT.replace(/\/$/, '')}/${R2_BUCKET_NAME}/${smokeKey}`);
  assert.ok([400, 401, 403, 404].includes(unsignedGet.status), 'Unsigned R2 object access must never succeed publicly');
  console.log(`[PASS] Unsigned R2 object GET denied with HTTP ${unsignedGet.status}.`);

  // Verify short-TTL signed GET works immediately then expires cleanly after 3s
  const shortTtlGetUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: smokeKey }),
    { expiresIn: 2 },
  );
  const validGet = await fetch(shortTtlGetUrl);
  assert.equal(validGet.status, 200, 'Fresh 2s signed GET URL must return 200');
  const bytes = Buffer.from(await validGet.arrayBuffer());
  assert.equal(bytes.length, TINY_JPEG.length, 'Downloaded R2 object byte length matches');
  console.log('[PASS] Authorised signed R2 portrait retrieval succeeded.');

  await new Promise((r) => setTimeout(r, 3500));
  const expiredGet = await fetch(shortTtlGetUrl);
  assert.ok([401, 403].includes(expiredGet.status), `Expected 401/403 after TTL expiry, got ${expiredGet.status}`);
  console.log(`[PASS] Expired signed R2 URL rejected with HTTP ${expiredGet.status}.`);

  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: smokeKey }));
  console.log('[PASS] Isolated smoke object deleted cleanly from R2.');
  console.log('=== STAGING LIVE SMOKE PASSED ===');
}

async function main() {
  if (!LIVE_CONFIRMED) {
    console.log('=== STAGING RESEND + R2 SMOKE TEST: DRY-RUN PREFLIGHT MODE ===');
    console.log('Zero external emails sent. Zero Cloudflare R2 objects written. Zero quotas spent.');
    const checks = evaluateReadiness();
    for (const c of checks) {
      console.log(` - [${c.ok ? 'CONFIGURED' : 'UNSET'}] ${c.name}`);
    }
    const missingCount = checks.filter((c) => !c.ok).length;
    console.log(`\nPreflight complete (${checks.length - missingCount}/${checks.length} staging credentials set locally).`);
    console.log(
      'To execute against an authorised staging environment after approval:\n' +
        '  ALLOW_LIVE_STAGING_SMOKE=true SMOKE_EMAIL=<test-inbox@ds.study.iitm.ac.in> node scripts/smoke-staging-resend-r2.mjs --confirm-live-quota',
    );
    return;
  }

  const missing = evaluateReadiness().filter((c) => !c.ok);
  if (missing.length > 0) {
    console.error('BLOCKED: Missing required staging environment variables for live smoke execution:');
    for (const m of missing) console.error(` - ${m.name}`);
    process.exit(2);
  }
  await runLiveSmoke();
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
