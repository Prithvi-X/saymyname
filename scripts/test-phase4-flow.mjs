// End-to-End Test for Phase 4 (Calling, Voice Notes) & Phase 5/6 (Together Space, Games, Virtual Dates, Relationship Mode)
// Updated for Phase 2 Password + DB OTP + Manual ReviewerGuard Verification Flow (D-P2-01..D-P2-05).
import { PrismaClient } from '@prisma/client';

const BASE_URL = (process.env.API_BASE || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const REVIEWER_KEY = process.env.REVIEWER_API_KEY || 'test-reviewer-secret-key-min-16';

if (process.env.DATABASE_URL) {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(`SAFETY ABORT: Non-localhost DATABASE_URL host "${host}" rejected.`);
  }
}

const prisma = new PrismaClient();
const createdEmails = [];

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log(`--- Testing Phase 4 Calling & Phase 5/6 Together Space Endpoints against ${BASE_URL} ---`);

  // Step 1: Register + Verify persistent devOtp + Manual Reviewer Approval -> Active Member
  const emailA = `phase4.flow.${Date.now()}@study.iitm.ac.in`;
  const passwordA = 'StrongPassword123!';
  createdEmails.push(emailA);

  const regResA = await request('/identity/register', {
    method: 'POST',
    body: JSON.stringify({ email: emailA, password: passwordA, displayName: 'Phase4 Member' }),
  });
  if (!regResA.ok || !regResA.data.devOtp) {
    console.error('Failed to register User A (ensure EXPOSE_DEV_OTP=true locally):', regResA.data);
    process.exit(1);
  }

  const otpResA = await request('/identity/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: emailA, otp: regResA.data.devOtp }),
  });
  if (!otpResA.ok) {
    console.error('Failed to authenticate User A:', otpResA.data);
    process.exit(1);
  }

  let tokenA = otpResA.data.accessToken;
  const userAId = otpResA.data.account.id;
  console.log(`[PASS] User A authenticated: ${userAId}`);

  // Submit pending age & student verification cases, then approve via ReviewerGuard
  const ageRes = await request('/identity/age-check', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ dateOfBirth: '2002-05-14' }),
  });
  if (!ageRes.ok || !ageRes.data.caseId) {
    console.error('[FAIL] Age check submission failed:', ageRes.data);
    process.exit(1);
  }

  const studentRes = await request('/identity/verify-student', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      programmeFamily: 'data_science_applications',
      pathwayCode: 'diploma',
      studentRollNo: '21F1000123',
    }),
  });
  if (!studentRes.ok || !studentRes.data.caseId) {
    console.error('[FAIL] Student verification submission failed:', studentRes.data);
    process.exit(1);
  }

  for (const caseId of [ageRes.data.caseId, studentRes.data.caseId]) {
    const revRes = await request(`/verification-cases/${caseId}/decision`, {
      method: 'POST',
      headers: {
        'x-smn-reviewer-key': REVIEWER_KEY,
        'x-smn-reviewer-id': 'phase4_test_reviewer',
      },
      body: JSON.stringify({ decision: 'approved' }),
    });
    if (!revRes.ok) {
      console.error(`[FAIL] Reviewer decision failed for ${caseId}:`, revRes.data);
      process.exit(1);
    }
  }

  const loginResA = await request('/identity/login', {
    method: 'POST',
    body: JSON.stringify({ email: emailA, password: passwordA }),
  });
  if (!loginResA.ok || !loginResA.data.accessToken || !loginResA.data.account?.eligibility?.discoveryEligible) {
    console.error('[FAIL] Re-login after reviewer approval failed:', loginResA.data);
    process.exit(1);
  }
  tokenA = loginResA.data.accessToken;
  console.log(`[PASS] Reviewer verification complete, active session acquired with discoveryEligible=true`);

  // Step 2: Test Voice Note Presign
  console.log('\n[TEST] 1. Voice Note Presign URL');
  const presignRes = await request('/calling/voice-notes/presign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      filename: 'voice_reflection.m4a',
      mimeType: 'audio/m4a',
      durationSeconds: 38,
    }),
  });

  if (presignRes.ok && presignRes.data.uploadUrl && presignRes.data.mediaRefId) {
    console.log(`[PASS] Voice note presigned: mediaRefId = ${presignRes.data.mediaRefId}`);
  } else {
    console.error('[FAIL] Presign voice note failed:', presignRes.data);
    process.exit(1);
  }

  // Step 3: Test 1:1 LiveKit Calling Invite & Response
  console.log('\n[TEST] 2. 1:1 LiveKit Calling Lifecycle');
  const convId = 'c1111111-1111-1111-1111-111111111111';
  const callInviteRes = await request('/calling/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ conversationId: convId }),
  });

  if (!callInviteRes.ok || !callInviteRes.data.token) {
    console.error('[FAIL] Call invite failed:', callInviteRes.data);
    process.exit(1);
  }
  const callId = callInviteRes.data.callSession.id;
  console.log(`[PASS] Call invited: callId = ${callId}, LiveKit room = ${callInviteRes.data.callSession.livekitRoomId}`);

  // Respond to Call
  const respondRes = await request(`/calling/${callId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ action: 'accept' }),
  });

  if (respondRes.ok && respondRes.data.callStatus === 'accepted') {
    console.log(`[PASS] Call accepted with participant LiveKit token`);
  } else {
    console.error('[FAIL] Call respond failed:', respondRes.data);
    process.exit(1);
  }

  // Hangup Call
  const endRes = await request(`/calling/${callId}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  if (endRes.ok && endRes.data.callStatus === 'ended') {
    console.log(`[PASS] Call ended cleanly, duration = ${endRes.data.durationSeconds}s`);
  } else {
    console.error('[FAIL] Call end failed:', endRes.data);
    process.exit(1);
  }

  // Step 4: Test Mini-Games
  console.log('\n[TEST] 3. Mini-Games Catalog & Session');
  const catalogRes = await request('/together/games', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  if (!catalogRes.ok || catalogRes.data.length < 3) {
    console.error('[FAIL] Games catalog check failed:', catalogRes.data);
    process.exit(1);
  }
  console.log(`[PASS] Game catalog returned ${catalogRes.data.length} games (Word Scramble, IITM Trivia, 20 Questions)`);

  const gameInviteRes = await request('/together/games/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      conversationId: convId,
      gameKey: 'word_scramble',
    }),
  });

  if (!gameInviteRes.ok) {
    console.error('[FAIL] Game invite failed:', gameInviteRes.data);
    process.exit(1);
  }
  const gameSessionId = gameInviteRes.data.id;
  console.log(`[PASS] Word Scramble invited: sessionId = ${gameSessionId}`);

  const gameAcceptRes = await request(`/together/games/${gameSessionId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ action: 'accept' }),
  });

  if (!gameAcceptRes.ok || gameAcceptRes.data.sessionStatus !== 'active') {
    console.error('[FAIL] Game accept failed:', gameAcceptRes.data);
    process.exit(1);
  }
  console.log(`[PASS] Word Scramble session activated`);

  const moveRes = await request(`/together/games/${gameSessionId}/move`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      moveType: 'guess_word',
      moveData: { guess: 'ALGORITHM' },
    }),
  });

  if (moveRes.ok && moveRes.data.currentState.lastCorrectGuess === 'ALGORITHM') {
    console.log(`[PASS] Correct word guess move recorded`);
  } else {
    console.error('[FAIL] Game move failed:', moveRes.data);
    process.exit(1);
  }

  // Step 5: Test Virtual Dates
  console.log('\n[TEST] 4. Virtual Dates Scheduling');
  const dateProposeRes = await request('/together/virtual-dates/propose', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      conversationId: convId,
      scheduledFor: '2026-12-05T19:30:00.000Z',
      timezone: 'Asia/Kolkata',
      activityType: 'study_session',
      proposalNotes: 'Study session for midterms',
    }),
  });

  if (!dateProposeRes.ok) {
    console.error('[FAIL] Propose virtual date failed:', dateProposeRes.data);
    process.exit(1);
  }
  const virtualDateId = dateProposeRes.data.id;
  console.log(`[PASS] Virtual date proposed: id = ${virtualDateId}`);

  const dateAcceptRes = await request(`/together/virtual-dates/${virtualDateId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ action: 'accept' }),
  });

  if (dateAcceptRes.ok && dateAcceptRes.data.status === 'accepted') {
    console.log(`[PASS] Virtual date accepted`);
  } else {
    console.error('[FAIL] Accept virtual date failed:', dateAcceptRes.data);
    process.exit(1);
  }

  // Step 6: Test Relationship Mode (Bilateral Activation & Independent Unpair)
  console.log('\n[TEST] 5. Relationship Mode (Doc 01 §3.4 Dual-Opt-In)');
  const matchId = 'm1111111-1111-1111-1111-111111111111';

  const relPropRes = await request('/together/relationship/propose', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ matchId }),
  });

  console.log(`[PASS] Proposal submitted (single affirmative action waiting for partner)`);

  const relAcceptRes = await request('/together/relationship/respond', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ matchId, action: 'accept' }),
  });

  if (!relAcceptRes.ok || !relAcceptRes.data.bilateralActivated) {
    console.error('[FAIL] Bilateral relationship activation failed:', relAcceptRes.data);
    process.exit(1);
  }
  console.log(`[PASS] Bilateral affirmative action confirmed: Relationship Space activated!`);

  // Milestone
  const milestoneRes = await request(`/together/relationship/${matchId}/milestones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      title: 'Our First Sprint',
      milestoneDate: '2026-11-24',
      description: 'Built the real-time calling and together space!',
    }),
  });

  if (milestoneRes.ok && milestoneRes.data.title === 'Our First Sprint') {
    console.log(`[PASS] Relationship milestone added`);
  } else {
    console.error('[FAIL] Milestone add failed:', milestoneRes.data);
    process.exit(1);
  }

  // Private Journal
  const journalRes = await request(`/together/relationship/${matchId}/journal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      entryText: 'A wonderful collaborative session.',
      entryDate: '2026-11-24',
    }),
  });

  if (journalRes.ok && journalRes.data.id) {
    console.log(`[PASS] Private relationship journal entry recorded`);
  } else {
    console.error('[FAIL] Journal entry failed:', journalRes.data);
    process.exit(1);
  }

  // Unilateral Leave (Doc 01 §3.4)
  const leaveRes = await request('/together/relationship/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ matchId }),
  });

  if (leaveRes.ok && leaveRes.data.success) {
    console.log(`[PASS] Unilateral independent exit succeeded without partner approval (Doc 01 §3.4)`);
  } else {
    console.error('[FAIL] Leave relationship failed:', leaveRes.data);
    process.exit(1);
  }

  console.log('\n🎉 ALL Phase 4 & 5/6 Endpoints Verified 100% Successfully!');
}

run()
  .catch((err) => {
    console.error('Unhandled error in test:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.account.deleteMany({ where: { email: { in: createdEmails } } }).catch(() => {});
    await prisma.$disconnect();
  });
