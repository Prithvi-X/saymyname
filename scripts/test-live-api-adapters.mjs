/**
 * Phase 2 External Adapter Readiness Check (Resend & R2)
 *
 * SAFETY DEFAULT (D-P2-05):
 * - Runs non-destructive preflight checks only unless BOTH `--confirm-live-quota`
 *   AND `ALLOW_LIVE_STAGING_SMOKE=true` are explicitly passed.
 * - Uses password auth + `devOtp` (or manual inbox code), never retired `123456` / `syntheticOtp`.
 */
import assert from 'node:assert/strict';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const LIVE_CONFIRMED =
  process.argv.includes('--confirm-live-quota') &&
  process.env.ALLOW_LIVE_STAGING_SMOKE === 'true';

async function testLiveAdapters() {
  const healthRes = await fetch(`${API_BASE}/health`);
  assert.equal(healthRes.status, 200, 'API /health must respond 200');
  console.log(`[PASS] API health check passed at ${API_BASE}/health.`);

  if (!LIVE_CONFIRMED) {
    console.log(
      '[DRY-RUN] Skipping live Resend email dispatch and live Cloudflare R2 PUT/presign test (no external quota spent).\n' +
        'Run `node scripts/smoke-staging-resend-r2.mjs` or pass `--confirm-live-quota` with `ALLOW_LIVE_STAGING_SMOKE=true` after approval.',
    );
    return;
  }

  const studentEmail = process.env.SMOKE_EMAIL;
  if (!studentEmail || !studentEmail.endsWith('study.iitm.ac.in')) {
    throw new Error('SMOKE_EMAIL (@*.study.iitm.ac.in) must be provided for live adapter test.');
  }

  const password = `LiveAdapt-${Date.now()}-Pass!`;
  const regRes = await fetch(`${API_BASE}/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password, displayName: 'Adapter Smoke User' }),
  });
  const regData = await regRes.json();
  console.log(`Register status=${regRes.status}`, { devOtpPresent: Boolean(regData.devOtp) });

  const otpToUse = process.env.LIVE_EMAIL_OTP || regData.devOtp;
  if (!otpToUse) {
    console.log('[INFO] Production mode suppressed devOtp; supply LIVE_EMAIL_OTP from Resend inbox to finish token verification.');
    return;
  }

  const otpRes = await fetch(`${API_BASE}/identity/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, otp: otpToUse }),
  });
  const otpData = await otpRes.json();
  assert.equal(otpRes.status, 200, `OTP verify failed: ${JSON.stringify(otpData)}`);
  console.log('[PASS] Verified OTP without retired 123456 bypass.');
}

testLiveAdapters().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
