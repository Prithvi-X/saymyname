/**
 * Phase 2 Identity & Manual Verification Pipeline Integration Script
 * Updated for D-P2-01..D-P2-05 (Password + DB OTP challenge + Manual Review Gate + ReviewerGuard).
 *
 * Refuses non-localhost DATABASE_URL. Cleans up created test accounts on completion.
 */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const REVIEWER_KEY = process.env.REVIEWER_API_KEY || 'test-reviewer-secret-key-min-16';
const TEST_PASSWORD = 'IdentityFlowPass123!';

if (process.env.DATABASE_URL) {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(`SAFETY ABORT: Non-localhost DATABASE_URL host "${host}" rejected.`);
  }
}

const prisma = new PrismaClient();
const createdEmails = [];

async function testIdentityPipeline() {
  const suffix = `${Date.now()}.${Math.floor(Math.random() * 1000)}`;
  const adultEmail = `idflow.adult.${suffix}@ds.study.iitm.ac.in`;
  const minorEmail = `idflow.minor.${suffix}@es.study.iitm.ac.in`;
  createdEmails.push(adultEmail, minorEmail);

  console.log(`\n=== Running Updated Identity & Verification Flow Checks against ${API_BASE} ===\n`);

  // 1. Minor Path: Register -> verify devOtp -> reject under-18 DOB (403) -> reject student submission (403)
  const minorRegRes = await fetch(`${API_BASE}/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: minorEmail, password: TEST_PASSWORD, displayName: 'Minor Check' }),
  });
  const minorReg = await minorRegRes.json();
  assert.equal(minorRegRes.status, 200, `Minor registration failed: ${JSON.stringify(minorReg)}`);
  assert.ok(minorReg.devOtp, 'EXPOSE_DEV_OTP must be enabled on local dev API to test OTP without email inbox');

  const minorVerifyRes = await fetch(`${API_BASE}/identity/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: minorEmail, otp: minorReg.devOtp }),
  });
  const minorVerify = await minorVerifyRes.json();
  assert.equal(minorVerifyRes.status, 200);
  const minorToken = minorVerify.accessToken;

  const minorAgeRes = await fetch(`${API_BASE}/identity/age-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
    body: JSON.stringify({ dateOfBirth: `${new Date().getUTCFullYear() - 17}-01-01` }),
  });
  assert.equal(minorAgeRes.status, 403, 'Under-18 DOB check must return 403');

  const minorStudentRes = await fetch(`${API_BASE}/identity/verify-student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
    body: JSON.stringify({ programmeFamily: 'electronic_systems', pathwayCode: 'foundation' }),
  });
  assert.equal(minorStudentRes.status, 403, 'Rejected minor must remain blocked from student step');
  console.log('[PASS] Under-18 rejection (403) and persistent minor student block verified.');

  // 2. Adult Path: Register -> static 123456 rejected -> devOtp -> login -> pending age & student -> ReviewerGuard
  const adultRegRes = await fetch(`${API_BASE}/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adultEmail, password: TEST_PASSWORD, displayName: 'Aarav Test' }),
  });
  const adultReg = await adultRegRes.json();
  assert.equal(adultRegRes.status, 200);

  const staticOtp = adultReg.devOtp === '123456' ? '000000' : '123456';
  const staticOtpRes = await fetch(`${API_BASE}/identity/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adultEmail, otp: staticOtp }),
  });
  assert.equal(staticOtpRes.status, 401, 'Static 123456 OTP fallback must fail 401');

  const verifyOkRes = await fetch(`${API_BASE}/identity/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adultEmail, otp: adultReg.devOtp }),
  });
  assert.equal(verifyOkRes.status, 200);

  const loginRes = await fetch(`${API_BASE}/identity/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adultEmail, password: TEST_PASSWORD }),
  });
  const loginData = await loginRes.json();
  assert.equal(loginRes.status, 200);
  const accessToken = loginData.accessToken;
  assert.ok(accessToken, 'Password login returns accessToken cleanly');

  const ageRes = await fetch(`${API_BASE}/identity/age-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ dateOfBirth: '2003-05-15' }),
  });
  const ageData = await ageRes.json();
  assert.equal(ageRes.status, 200);
  assert.equal(ageData.ageStatus, 'pending', 'Self-declared 18+ DOB stays pending manual review');
  assert.equal(ageData.eligibility?.discoveryEligible, false);

  const studentRes = await fetch(`${API_BASE}/identity/verify-student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ programmeFamily: 'data_science_applications', pathwayCode: 'diploma' }),
  });
  const studentData = await studentRes.json();
  assert.equal(studentRes.status, 200);
  assert.equal(studentData.studentStatus, 'pending', 'Student check enters pending manual review');
  assert.equal(studentData.discoveryEligible, false);
  console.log('[PASS] Adult age + student submissions stay pending review without auto-approval.');

  // 3. Manual Reviewer Queue & Approval
  const queueRes = await fetch(`${API_BASE}/verification-cases/pending`, {
    headers: { 'x-smn-reviewer-key': REVIEWER_KEY, 'x-smn-reviewer-id': 'idflow_reviewer' },
  });
  assert.equal(queueRes.status, 200);
  const queueJson = await queueRes.json();
  assert.equal(queueJson.integrationMode, 'manual_review_only_no_external_provider');
  const queueIds = new Set((queueJson.cases || []).map((c) => c.id));
  assert.ok(queueIds.has(ageData.caseId) && queueIds.has(studentData.caseId));

  for (const caseId of [ageData.caseId, studentData.caseId]) {
    const revRes = await fetch(`${API_BASE}/verification-cases/${caseId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-smn-reviewer-key': REVIEWER_KEY,
        'x-smn-reviewer-id': 'idflow_reviewer',
      },
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(revRes.status, 200);
  }

  const finalMeRes = await fetch(`${API_BASE}/identity/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const finalMe = await finalMeRes.json();
  assert.equal(finalMeRes.status, 200);
  assert.equal(finalMe.eligibility?.discoveryEligible, true);
  assert.equal(finalMe.accountStatus, 'active');
  console.log('[PASS] Authorised manual review unlocked discoveryEligible=true and accountStatus=active.\n');
}

testIdentityPipeline()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.account.deleteMany({ where: { email: { in: createdEmails } } }).catch(() => {});
    await prisma.$disconnect();
  });
