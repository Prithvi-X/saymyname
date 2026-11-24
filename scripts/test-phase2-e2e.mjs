import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PrismaClient } from '@saymyname/database';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3001';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:4000/api/v1';
const REVIEWER_KEY = process.env.REVIEWER_API_KEY || 'test-reviewer-secret-key-min-16';

const envContent = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const dbUrlMatch = envContent.match(/^DATABASE_URL=([^\r\n]+)/m);
const dbUrl = dbUrlMatch?.[1]?.trim() || process.env.DATABASE_URL;
assert.ok(dbUrl && dbUrl.includes('localhost:5433'), `Tests MUST run strictly against isolated local Postgres, got: ${dbUrl}`);

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

class CookieJar {
  cookies = new Map();
  absorb(res) {
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const first = raw.split(';')[0];
      const eq = first.indexOf('=');
      if (eq === -1) continue;
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1).trim();
      if (raw.toLowerCase().includes('max-age=0')) {
        this.cookies.delete(k);
      } else {
        this.cookies.set(k, v);
      }
    }
  }
  header() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
  get(k) {
    return this.cookies.get(k);
  }
}

async function bffReq(jar, path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (jar.header()) headers['Cookie'] = jar.header();
  if ((opts.method || 'GET').toUpperCase() !== 'GET' && !opts.omitCsrf && jar.get('smn_csrf')) {
    headers['X-SMN-CSRF'] = jar.get('smn_csrf');
  }
  const res = await fetch(`${WEB_BASE}${path}`, {
    ...opts,
    headers,
    redirect: 'manual',
  });
  jar.absorb(res);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, json, text };
}

async function run() {
  console.log('=== PHASE 2 END-TO-END SECURITY & ONBOARDING SUITE ===');
  const suffix = Date.now();
  const validEmail = `p2.synth.${suffix}@study.iitm.ac.in`;
  const minorEmail = `p2.minor.${suffix}@ds.study.iitm.ac.in`;
  const createdEmails = [validEmail, minorEmail];

  // 1. PUB-001..006: Public routes, Document 10 honesty, zero prohibited copy
  for (const route of ['/', '/eligibility', '/safety', '/privacy', '/terms', '/support', '/login', '/onboarding', '/forgot-password', '/reset-password']) {
    const res = await fetch(`${WEB_BASE}${route}`);
    assert.equal(res.status, 200, `Public route ${route} must return 200`);
    const html = await res.text();
    assert.equal(html.includes('physically impossible'), false, `Prohibited claim on ${route}`);
    assert.equal(html.includes('Warm Editorial Minimalism'), false, `Retired theme text on ${route}`);
    assert.equal(html.includes('[Pending'), false, `Bracketed placeholder leaked on ${route}`);
    assert.equal(html.includes('support@saymyname.in'), false, `Unconfigured invented email leaked on ${route}`);
    assert.equal(html.includes('unsplash.com'), false, `Stock portrait URL found on ${route}`);
  }
  console.log('PASS [PUB-001..006]: All 10 public/auth routes return 200 with clean Document 10 copy.');

  // 2. Unauthenticated SSR/Edge Protection & /register Redirect + Open-Redirect Safety Check
  const regRedirectRes = await fetch(`${WEB_BASE}/register`, { redirect: 'manual' });
  assert.ok(regRedirectRes.status >= 300 && regRedirectRes.status < 400, '/register must redirect cleanly (never 404)');
  assert.equal(regRedirectRes.headers.get('location'), '/onboarding', '/register redirects cleanly to /onboarding');

  const regSafeReturn = await fetch(`${WEB_BASE}/register?returnUrl=%2Fmatches`, { redirect: 'manual' });
  assert.equal(regSafeReturn.headers.get('location'), '/onboarding?returnUrl=%2Fmatches');

  for (const unsafeTarget of ['//evil.com', 'https://evil.com', '/\\evil.com', '/login']) {
    const evilRes = await fetch(`${WEB_BASE}/register?returnUrl=${encodeURIComponent(unsafeTarget)}`, {
      redirect: 'manual',
    });
    assert.equal(evilRes.headers.get('location'), '/onboarding', `Unsafe returnUrl "${unsafeTarget}" must be stripped`);
  }

  for (const privRoute of ['/discover', '/likes', '/matches', '/chats', '/profile']) {
    const res = await fetch(`${WEB_BASE}${privRoute}`, { redirect: 'manual' });
    assert.ok(res.status >= 300 && res.status < 400, `${privRoute} must redirect unauthenticated visitors`);
    const loc = res.headers.get('location') || '';
    assert.ok(loc.includes('/login'), `${privRoute} must redirect to /login, got ${loc}`);
  }
  const tamperedRes = await fetch(`${WEB_BASE}/discover`, {
    headers: { Cookie: 'smn_access_token=tampered.jwt.token' },
    redirect: 'manual',
  });
  assert.ok(tamperedRes.status >= 300 && tamperedRes.status < 400 && (tamperedRes.headers.get('location') || '').includes('/login'), 'Tampered token must fail closed');
  console.log('PASS [SES-001..002]: Unauthenticated & tampered sessions denied access cleanly.');

  // 3. CSRF Initialization & Rejection
  const jar = new CookieJar();
  const meInit = await bffReq(jar, '/api/auth/me');
  assert.equal(meInit.status, 401);
  assert.ok(jar.get('smn_csrf'), 'CSRF cookie must be initialized');

  const noCsrfRes = await bffReq(jar, '/api/auth/register', {
    method: 'POST',
    omitCsrf: true,
    body: JSON.stringify({ email: validEmail, password: 'Password123!' }),
  });
  assert.equal(noCsrfRes.status, 403, 'Missing X-SMN-CSRF must be rejected with 403');
  console.log('PASS [SES-003]: BFF CSRF guard rejects requests without X-SMN-CSRF.');

  // 4. REG-001..008: Strict BS Domain Allowlist & Password Validation
  for (const badEmail of ['faculty@iitm.ac.in', 'btech@smail.iitm.ac.in', 'spoof@evilstudy.iitm.ac.in', 'user@gmail.com']) {
    const r = await bffReq(jar, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: badEmail, password: 'Password123!' }),
    });
    assert.equal(r.status, 400, `Out-of-scope email ${badEmail} must be rejected`);
  }
  const weakPwd = await bffReq(jar, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail, password: 'short' }),
  });
  assert.equal(weakPwd.status, 400, 'Short password rejected');

  const reg = await bffReq(jar, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail, password: 'Password123!', displayName: 'Aarav Test' }),
  });
  assert.equal(reg.status, 200, `Registration failed: ${reg.text}`);
  assert.ok(reg.json.devOtp, 'Non-prod test harness receives issued CSPRNG OTP');

  // Resend cooldown must enforce 429 within 60s
  const cooldownRes = await bffReq(jar, '/api/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail }),
  });
  assert.equal(cooldownRes.status, 429, 'Immediate OTP resend must trigger 429 cooldown');
  console.log('PASS [REG-001..008]: Domain allowlist, password checks & 60s resend cooldown enforced.');

  // 5. OTP-001..006: Reject static '123456', reject passwordless login, verify real challenge, verify HttpOnly cookies
  const badLoginPwdless = await bffReq(jar, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail }),
  });
  assert.equal(badLoginPwdless.status, 400, 'Passwordless login attempt must be rejected');

  const unverifiedLogin = await bffReq(jar, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail, password: 'Password123!' }),
  });
  assert.equal(unverifiedLogin.status, 403, 'Login before OTP verification must return 403');

  const staticOtpFail = await bffReq(jar, '/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail, otp: reg.json.devOtp === '123456' ? '000000' : '123456' }),
  });
  assert.equal(staticOtpFail.status, 401, 'Static 123456 OTP fallback must fail');

  const otpOk = await bffReq(jar, '/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail, otp: reg.json.devOtp }),
  });
  assert.equal(otpOk.status, 200, `Valid OTP failed: ${otpOk.text}`);
  assert.equal(otpOk.json.accessToken, undefined, 'BFF MUST strip accessToken from browser JSON');
  assert.equal(otpOk.json.refreshToken, undefined, 'BFF MUST strip refreshToken from browser JSON');
  assert.ok(jar.get('smn_access_token'), 'HttpOnly access cookie set');
  assert.ok(jar.get('smn_refresh_token'), 'HttpOnly refresh cookie set');
  console.log('PASS [OTP-001..006]: DB OTP verified, 123456 disabled, tokens strictly inside HttpOnly cookies.');

  // 6. State Guard Check during incomplete onboarding (must redirect /discover -> /onboarding)
  const incompleteDisc = await bffReq(jar, '/discover');
  const incompleteLoc = incompleteDisc.headers.get('location') || '';
  assert.ok(
    incompleteDisc.status >= 300 && incompleteDisc.status < 400 && incompleteLoc.includes('/onboarding'),
    `Expected /discover redirect to /onboarding for incomplete user, got status=${incompleteDisc.status} location=${incompleteLoc}`,
  );

  // 7. ELG-001..007: Verification Boundaries (No Auto-Approval, Minor Refusal, No Gov ID, Reviewer Decision)
  const badFutureDob = await bffReq(jar, '/api/bff/v1/verification-cases/age', {
    method: 'POST',
    body: JSON.stringify({ dateOfBirth: '2049-01-01' }),
  });
  assert.equal(badFutureDob.status, 400, 'Future DOB rejected');

  const adultAgeRes = await bffReq(jar, '/api/bff/v1/verification-cases/age', {
    method: 'POST',
    body: JSON.stringify({ dateOfBirth: '2003-04-12' }),
  });
  assert.equal(adultAgeRes.status, 200);
  assert.equal(adultAgeRes.json.ageStatus, 'pending', 'Self-declared DOB MUST remain pending review');
  const ageCaseId = adultAgeRes.json.caseId;

  const govIdReject = await bffReq(jar, '/api/bff/v1/verification-cases/evidence/presign', {
    method: 'POST',
    body: JSON.stringify({ evidenceType: 'aadhaar_card', mimeType: 'application/pdf', fileSizeBytes: 1000 }),
  });
  assert.equal(govIdReject.status, 400, 'Gov ID collection must be rejected');

  const studentSub = await bffReq(jar, '/api/bff/v1/verification-cases/student', {
    method: 'POST',
    body: JSON.stringify({ programmeFamily: 'data_science_applications', pathwayCode: 'diploma' }),
  });
  assert.equal(studentSub.status, 200);
  assert.equal(studentSub.json.studentStatus, 'pending');
  assert.equal(studentSub.json.discoveryEligible, false, 'Student submission MUST NOT auto-approve');
  const studentCaseId = studentSub.json.caseId;

  // Minor flow test: register -> verify OTP -> <18 DOB -> blocked from student step
  const minorJar = new CookieJar();
  await bffReq(minorJar, '/api/auth/me');
  const minReg = await bffReq(minorJar, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: minorEmail, password: 'Password123!' }),
  });
  await bffReq(minorJar, '/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: minorEmail, otp: minReg.json.devOtp }),
  });
  const minAge = await bffReq(minorJar, '/api/bff/v1/verification-cases/age', {
    method: 'POST',
    body: JSON.stringify({ dateOfBirth: `${new Date().getUTCFullYear() - 17}-01-01` }),
  });
  assert.equal(minAge.status, 403, 'Minor age submission rejected 403');
  const minStudentBlocked = await bffReq(minorJar, '/api/bff/v1/verification-cases/student', {
    method: 'POST',
    body: JSON.stringify({ programmeFamily: 'electronic_systems', pathwayCode: 'foundation' }),
  });
  assert.equal(minStudentBlocked.status, 403, 'Rejected minor permanently blocked from student step');

  // Reviewer queue & boundary checks: unauthenticated/wrong key fails 403; valid key lists open cases & unlocks
  const badQueue = await fetch(`${API_BASE}/verification-cases/pending`);
  assert.equal(badQueue.status, 403, 'Reviewer queue without credential rejected 403');

  const badEvidence = await fetch(`${API_BASE}/verification-cases/evidence/00000000-0000-0000-0000-000000000000/url`, {
    headers: { 'x-smn-reviewer-key': 'wrong-key' },
  });
  assert.equal(badEvidence.status, 403, 'Evidence signed-URL endpoint with wrong key rejected 403');

  const pendingQueueRes = await fetch(`${API_BASE}/verification-cases/pending`, {
    headers: { 'x-smn-reviewer-key': REVIEWER_KEY, 'x-smn-reviewer-id': 'qa_reviewer' },
  });
  assert.equal(pendingQueueRes.status, 200, 'Reviewer queue accessible with valid key');
  const queueJson = await pendingQueueRes.json();
  assert.equal(queueJson.integrationMode, 'manual_review_only_no_external_provider');
  const queuedIds = new Set((queueJson.cases || []).map((c) => c.id));
  assert.ok(queuedIds.has(ageCaseId) && queuedIds.has(studentCaseId), 'Pending age + student cases visible in reviewer queue');
  assert.equal(JSON.stringify(queueJson).includes(validEmail), false, 'Reviewer queue never exposes full email PII');

  const badReviewer = await fetch(`${API_BASE}/verification-cases/${ageCaseId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-smn-reviewer-key': 'wrong-key' },
    body: JSON.stringify({ decision: 'approved' }),
  });
  assert.equal(badReviewer.status, 403, 'Invalid reviewer key rejected 403');

  for (const cid of [ageCaseId, studentCaseId]) {
    const revRes = await fetch(`${API_BASE}/verification-cases/${cid}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-smn-reviewer-key': REVIEWER_KEY,
        'x-smn-reviewer-id': 'qa_reviewer',
      },
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(revRes.status, 200, `Reviewer approval failed for ${cid}`);
  }

  const postApproveQueue = await (await fetch(`${API_BASE}/verification-cases/pending`, {
    headers: { 'x-smn-reviewer-key': REVIEWER_KEY, 'x-smn-reviewer-id': 'qa_reviewer' },
  })).json();
  const postQueuedIds = new Set((postApproveQueue.cases || []).map((c) => c.id));
  assert.ok(!postQueuedIds.has(ageCaseId) && !postQueuedIds.has(studentCaseId), 'Approved cases leave open queue');
  console.log('PASS [ELG-001..007]: Pending review queue operable, minors blocked, gov ID rejected, reviewer gate verified.');

  // 8. ONB-001..010: Draft Save Without Photo -> Publish Blocked -> Portrait Upload -> Live Member
  const draftBeforePhoto = await bffReq(jar, '/api/bff/v1/profiles/me', {
    method: 'PUT',
    body: JSON.stringify({
      displayName: 'Aarav Verma',
      bio: 'Remote BS Data Science student enjoying chess and acoustic guitar.',
      locationCity: 'Pune',
      locationState: 'Maharashtra',
      intention: 'Long-term intentional relationship',
      interests: ['Machine Learning', 'Chess & Strategy'],
    }),
  });
  assert.equal(draftBeforePhoto.status, 200);
  assert.equal(draftBeforePhoto.json.isPublished, false, 'Draft remains unpublished');

  const pubNoPhoto = await bffReq(jar, '/api/bff/v1/profiles/me/publish', {
    method: 'POST',
    body: JSON.stringify({ isPublished: true, acceptGuidelinesConsent: true }),
  });
  assert.equal(pubNoPhoto.status, 400, 'Publish WITHOUT genuine portrait photo must fail 400');

  const presign = await bffReq(jar, '/api/bff/v1/profiles/me/photos/presign', {
    method: 'POST',
    body: JSON.stringify({ filename: 'portrait.jpg', mimeType: 'image/jpeg', fileSizeBytes: 64000 }),
  });
  assert.equal(presign.status, 200);

  const attachPhoto = await bffReq(jar, '/api/bff/v1/profiles/me/photos', {
    method: 'POST',
    body: JSON.stringify({ s3Key: presign.json.s3Key, mimeType: 'image/jpeg', isPrimary: true }),
  });
  assert.equal(attachPhoto.status, 201);

  const pubOk = await bffReq(jar, '/api/bff/v1/profiles/me/publish', {
    method: 'POST',
    body: JSON.stringify({ isPublished: true, acceptGuidelinesConsent: true }),
  });
  assert.equal(pubOk.status, 200);
  assert.equal(pubOk.json.isPublished, true);
  assert.equal(pubOk.json.profileStatus, 'live');

  // Verify ACTIVE_MEMBER state and Discover access
  const meActive = await bffReq(jar, '/api/auth/me');
  assert.equal(meActive.status, 200);
  assert.equal(meActive.json.lifecycleState, 'ACTIVE_MEMBER');
  const candidatesRes = await bffReq(jar, '/api/bff/v1/dating/candidates');
  assert.equal(candidatesRes.status, 200);
  assert.equal(JSON.stringify(candidatesRes.json).includes('unsplash.com'), false);
  console.log('PASS [ONB-001..010]: Draft saves without photo, publish requires photo, Discover unlocked.');

  // 9. Password Reset & Session Rotation + Replay Revocation
  const firstRefresh = jar.get('smn_refresh_token');
  const rot1 = await bffReq(jar, '/api/auth/refresh', { method: 'POST', body: '{}' });
  assert.equal(rot1.status, 200);
  const secondRefresh = jar.get('smn_refresh_token');
  assert.notEqual(secondRefresh, firstRefresh, 'Refresh token rotated cleanly');

  // Replay old rotated token directly -> must revoke whole family
  const replayRes = await fetch(`${API_BASE}/identity/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: firstRefresh }),
  });
  assert.equal(replayRes.status, 401, 'Replayed refresh token rejected');
  const postReplay = await bffReq(jar, '/api/auth/refresh', { method: 'POST', body: '{}' });
  assert.equal(postReplay.status, 401, 'Entire token family invalidated on replay');

  // Forgot + Reset password -> Sign in with new password
  const forgot = await bffReq(jar, '/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail }),
  });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.json.devResetToken);
  const reset = await bffReq(jar, '/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: forgot.json.devResetToken, newPassword: 'NewPassword456!' }),
  });
  assert.equal(reset.status, 200);
  const relogin = await bffReq(jar, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: validEmail, password: 'NewPassword456!' }),
  });
  assert.equal(relogin.status, 200);
  console.log('PASS [SES-004..007]: Refresh rotation, replay revocation, password reset & re-login passed.');

  // Cleanup synthetic local test records
  await prisma.account.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
  console.log('=== ALL PHASE 2 E2E & SECURITY CHECKS PASSED ===');
}

run().catch(async (err) => {
  console.error('FAILED:', err);
  await prisma.$disconnect();
  process.exit(1);
});
