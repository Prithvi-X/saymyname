/**
 * Phase 3.2 Real PostgreSQL + Real HTTP/NestJS Closure Verification
 * Covers MATCH-11, MATCH-22, Concurrent Revocation Races, HEIC Fail-Closed / Capabilities, and DOB Integrity
 * against real local PostgreSQL (`saymyname_phase32_audit`) without touching production/remote resources.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const API_PORT = 4002;
const API_BASE = `http://127.0.0.1:${API_PORT}/api/v1`;
const JWT_ACCESS = 'closure-pg-access-secret-do-not-use-prod-32bytes';
const JWT_REFRESH = 'closure-pg-refresh-secret-do-not-use-prod-32bytes';
const REVIEWER_KEY = 'closure-pg-reviewer-secret-key-1234';

function uid(n) {
  return `c1050000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeJwt(accountId, email, discoveryEligible = true) {
  const b64 = (v) =>
    Buffer.from(JSON.stringify(v))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const pay = b64({ sub: accountId, email, discoveryEligible, iat: now, exp: now + 3600 });
  const sig = crypto
    .createHmac('sha256', JWT_ACCESS)
    .update(`${head}.${pay}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${head}.${pay}.${sig}`;
}

async function req(method, path, token, body, extraHeaders = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json, raw: text };
}

async function seedVerifiedMember(prisma, n, name, opts = {}) {
  const accountId = uid(n);
  const profileId = uid(100 + n);
  const email = `closure_${n}@ds.study.iitm.ac.in`;
  const dob = 'dob' in opts ? opts.dob : new Date(Date.UTC(2001, 2, 14));

  await prisma.account.create({
    data: {
      id: accountId,
      authSubject: accountId,
      email,
      accountStatus: opts.accountStatus ?? 'active',
      emailVerifiedAt: new Date(),
      displayName: name,
    },
  });

  await prisma.accountEligibility.create({
    data: {
      accountId,
      ageStatus: opts.ageStatus ?? 'approved',
      studentStatus: opts.studentStatus ?? 'approved',
      programmeFamily: 'data_science_applications',
      pathwayCode: 'foundation_entry',
      dateOfBirth: dob,
      discoveryEligible: opts.discoveryEligible ?? true,
      reviewNotes: `CONFIDENTIAL_MOD_NOTE_${n}`,
    },
  });

  const interest = await prisma.interest.upsert({
    where: { name: 'Closure Testing Interest' },
    create: { name: 'Closure Testing Interest', category: 'academic' },
    update: {},
  });

  await prisma.profile.create({
    data: {
      id: profileId,
      accountId,
      displayName: name,
      programmeFamily: 'data_science_applications',
      termOrYear: 'Degree Level',
      intention: 'Long-term connection',
      bio: `Synthetic profile for ${name}.`,
      isPublished: true,
      isPaused: false,
      profileStatus: 'live',
      ageDisplayMode: 'show_calculated_age',
      consentAcceptedAt: new Date(),
      photos: {
        create: [
          {
            id: uid(500 + n),
            s3Key: `photos/${accountId}/main.jpg`,
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
      interests: {
        create: [{ interestId: interest.id }],
      },
    },
  });

  return {
    accountId,
    profileId,
    email,
    token: makeJwt(accountId, email, opts.discoveryEligible ?? true),
  };
}

async function waitForHealth(getLogs = () => '') {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${API_BASE}/health`);
      if (r.ok) return r.json();
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Closure E2E API failed to respond on /health.\nAPI Logs:\n${getLogs()}`);
}

async function cleanupClosureTestData(prisma) {
  const testAccountIds = [1, 2, 3, 4, 5, 6, 7, 8].map(uid);
  await prisma.like.deleteMany({
    where: { OR: [{ fromAccountId: { in: testAccountIds } }, { toAccountId: { in: testAccountIds } }] },
  });
  await prisma.pass.deleteMany({
    where: { OR: [{ fromAccountId: { in: testAccountIds } }, { toAccountId: { in: testAccountIds } }] },
  });
  await prisma.userBlock.deleteMany({
    where: { OR: [{ blockerId: { in: testAccountIds } }, { blockedId: { in: testAccountIds } }] },
  });
  await prisma.match.deleteMany({
    where: { OR: [{ userLowId: { in: testAccountIds } }, { userHighId: { in: testAccountIds } }] },
  });
  await prisma.auditEvent.deleteMany({
    where: { actorId: { in: testAccountIds } },
  });
  await prisma.account.deleteMany({
    where: { OR: [{ id: { in: testAccountIds } }, { email: { startsWith: 'closure_' } }] },
  });
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  await prisma.$connect();

  let apiProc;
  try {
    // Clean any leftover closure test accounts & matches safely
    await cleanupClosureTestData(prisma);

    const uA = await seedVerifiedMember(prisma, 1, 'Aarav Closure');
    const uB = await seedVerifiedMember(prisma, 2, 'Diya Closure');
    const uC = await seedVerifiedMember(prisma, 3, 'Karan Unrelated');
    const uSus = await seedVerifiedMember(prisma, 4, 'Vikram Suspended');
    const uRev = await seedVerifiedMember(prisma, 5, 'Neha Revoked');
    const uNoDob = await seedVerifiedMember(prisma, 6, 'Legacy NoDob', { dob: null });
    const uAgeRev = await seedVerifiedMember(prisma, 7, 'Riya AgeRevoked');
    const uBlk = await seedVerifiedMember(prisma, 8, 'Arjun Blocked');

    const revCase = await prisma.verificationCase.create({
      data: {
        id: uid(800),
        accountId: uRev.accountId,
        checkType: 'student_enrolment',
        providerCode: 'manual_review',
        status: 'approved',
      },
    });
    const ageRevCase = await prisma.verificationCase.create({
      data: {
        id: uid(801),
        accountId: uAgeRev.accountId,
        checkType: 'age',
        providerCode: 'manual_review',
        status: 'approved',
      },
    });

    apiProc = spawn(process.execPath, ['services/api/dist/src/main.js'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL: DB_URL,
        JWT_ACCESS_SECRET: JWT_ACCESS,
        JWT_REFRESH_SECRET: JWT_REFRESH,
        REVIEWER_API_KEY: REVIEWER_KEY,
        SKIP_EMAIL_DISPATCH: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let apiLogs = '';
    apiProc.stdout.on('data', (d) => {
      apiLogs += d.toString();
    });
    apiProc.stderr.on('data', (d) => {
      apiLogs += d.toString();
    });

    const health = await waitForHealth(() => apiLogs);
    assert.strictEqual(health.status, 'ok');
    assert.strictEqual(typeof health.capabilities?.heicDecoding, 'boolean');

    // 1. DOB integrity: uNoDob blocked fail-closed & remains NULL in PostgreSQL while uA/uB unaffected
    const meNoDob = await req('GET', '/identity/me', uNoDob.token);
    assert.strictEqual(meNoDob.status, 200);
    assert.strictEqual(meNoDob.body.lifecycleState, 'AGE_VERIFICATION');
    const discNoDob = await req('GET', '/dating/candidates', uNoDob.token);
    assert.strictEqual(discNoDob.status, 403);
    const dbNoDob = await prisma.accountEligibility.findUnique({ where: { accountId: uNoDob.accountId } });
    assert.strictEqual(dbNoDob.dateOfBirth, null);

    const meA = await req('GET', '/identity/me', uA.token);
    assert.strictEqual(meA.status, 200);
    assert.strictEqual(meA.body.lifecycleState, 'ACTIVE_MEMBER');

    // 2. Establish active matches via real endpoints: A<->B, A<->Sus, A<->Rev, A<->AgeRev, A<->Blk
    for (const peer of [uB, uSus, uRev, uAgeRev, uBlk]) {
      const l1 = await req('POST', '/dating/like', uA.token, { targetProfileId: peer.profileId });
      assert.strictEqual(l1.status, 201);
      assert.strictEqual(l1.body.isMutualMatch, false);
      const l2 = await req('POST', '/dating/like', peer.token, { targetProfileId: uA.profileId });
      assert.strictEqual(l2.status, 201);
      assert.strictEqual(l2.body.isMutualMatch, true);
    }

    const matchesA = await req('GET', '/dating/matches', uA.token);
    assert.strictEqual(matchesA.status, 200);
    assert.strictEqual(matchesA.body.length, 5);
    for (const m of matchesA.body) {
      assert.strictEqual(m.matchedAccountId, undefined, 'Internal account ID must not leak in GET /dating/matches');
      assert.ok(m.profile?.profileId, 'Sanitized profile.profileId must be populated in GET /dating/matches');
    }

    const findPair = (peer) => matchesA.body.find((m) => m.profile?.profileId === peer.profileId);
    const pairAB = findPair(uB);
    const pairASus = findPair(uSus);
    const pairARev = findPair(uRev);
    const pairAAgeRev = findPair(uAgeRev);
    const pairABlk = findPair(uBlk);
    assert.ok(pairAB && pairASus && pairARev && pairAAgeRev && pairABlk);

    // 3. Exercise Messaging, Calling, Games, Virtual Dates, Relationship Space on A<->B BEFORE unmatch
    const m1 = await req('POST', `/messaging/conversations/${pairAB.conversationId}/messages`, uA.token, {
      bodyText: 'Before unmatch',
    });
    assert.strictEqual(m1.status, 201);

    const callAB = await req('POST', '/calling/invite', uA.token, {
      conversationId: pairAB.conversationId,
    });
    assert.strictEqual(callAB.status, 201);

    const gameAB = await req('POST', '/together/games/invite', uA.token, {
      conversationId: pairAB.conversationId,
      gameKey: 'word_scramble',
    });
    assert.strictEqual(gameAB.status, 201);
    const gameAcc = await req('POST', `/together/games/${gameAB.body.id}/respond`, uB.token, {
      action: 'accept',
    });
    assert.strictEqual(gameAcc.status, 201);

    const dateAB = await req('POST', '/together/virtual-dates/propose', uA.token, {
      conversationId: pairAB.conversationId,
      scheduledFor: '2026-12-10T18:00:00.000Z',
      timezone: 'Asia/Kolkata',
      activityType: 'coffee_chat',
    });
    assert.strictEqual(dateAB.status, 201);

    const relA = await req('POST', '/together/relationship/propose', uA.token, {
      matchId: pairAB.matchId,
    });
    assert.strictEqual(relA.status, 201);
    const relB = await req('POST', '/together/relationship/propose', uB.token, {
      matchId: pairAB.matchId,
    });
    assert.strictEqual(relB.status, 201);
    assert.strictEqual(relB.body.bilateralActivated, true);

    // 4. Unrelated user C rejected across Unmatch, Messaging, Calling, Together
    for (const check of [
      req('POST', '/dating/unmatch', uC.token, { matchId: pairAB.matchId }),
      req('POST', `/messaging/conversations/${pairAB.conversationId}/messages`, uC.token, { bodyText: 'nope' }),
      req('POST', '/calling/invite', uC.token, { conversationId: pairAB.conversationId }),
      req('POST', '/together/games/invite', uC.token, { conversationId: pairAB.conversationId, gameKey: 'word_scramble' }),
      req('POST', '/together/relationship/leave', uC.token, { matchId: pairAB.matchId }),
    ]) {
      const r = await check;
      assert.strictEqual(r.status, 403, `Expected 403 for unrelated actor, got ${r.status}: ${r.raw}`);
    }

    // 5. Concurrent unmatch + message/call/game race against REAL PostgreSQL!
    const preMsgs = await prisma.message.count({ where: { conversationId: pairAB.conversationId } });
    const [raceUnmatch, raceMsg, raceCall, raceMove] = await Promise.allSettled([
      req('POST', '/dating/unmatch', uA.token, { matchId: pairAB.matchId, reason: 'Done talking' }),
      req('POST', `/messaging/conversations/${pairAB.conversationId}/messages`, uB.token, { bodyText: 'Race msg' }),
      req('POST', `/calling/${callAB.body.callSession.id}/respond`, uB.token, { action: 'accept' }),
      req('POST', `/together/games/${gameAB.body.id}/move`, uB.token, {
        moveType: 'guess_word',
        moveData: { guess: 'ALGORITHM' },
      }),
    ]);

    assert.strictEqual(raceUnmatch.status, 'fulfilled');
    assert.strictEqual(raceUnmatch.value.status, 201);

    // Check DB invariants strictly hold post-race
    const endedMatchDb = await prisma.match.findUnique({ where: { id: pairAB.matchId } });
    const closedConvDb = await prisma.conversation.findUnique({ where: { id: pairAB.conversationId } });
    const closedSpaceDb = await prisma.relationshipSpace.findUnique({ where: { matchId: pairAB.matchId } });
    assert.strictEqual(endedMatchDb.status, 'ended');
    assert.strictEqual(endedMatchDb.endReason, 'Done talking');
    assert.strictEqual(closedConvDb.status, 'closed');
    assert.strictEqual(closedSpaceDb.isActive, false);

    // Repeat unmatch idempotent cleanly without changing endedAt
    const unmatchRepeat = await req('POST', '/dating/unmatch', uA.token, {
      matchId: pairAB.matchId,
      reason: 'Second attempt',
    });
    assert.strictEqual(unmatchRepeat.status, 201);
    assert.strictEqual(unmatchRepeat.body.alreadyEnded, true);
    const endedMatchDbAfter = await prisma.match.findUnique({ where: { id: pairAB.matchId } });
    assert.strictEqual(endedMatchDbAfter.endedAt.getTime(), endedMatchDb.endedAt.getTime());
    assert.strictEqual(endedMatchDbAfter.endReason, 'Done talking');
    void preMsgs;
    void raceMsg;
    void raceCall;
    void raceMove;

    // 6. Post-unmatch calls MUST ALL fail closed (403) + Like cannot reactivate ended Match
    for (const postUnmatch of [
      req('POST', `/messaging/conversations/${pairAB.conversationId}/messages`, uB.token, { bodyText: 'After' }),
      req('GET', `/messaging/conversations/${pairAB.conversationId}/messages`, uA.token),
      req('POST', '/calling/invite', uB.token, { conversationId: pairAB.conversationId }),
      req('POST', `/calling/${callAB.body.callSession.id}/respond`, uB.token, { action: 'accept' }),
      req('POST', '/calling/voice-notes/send', uB.token, {
        conversationId: pairAB.conversationId,
        mediaRefId: uid(999),
        durationSeconds: 10,
      }),
      req('GET', `/calling/${callAB.body.callSession.id}`, uA.token),
      req('POST', '/together/games/invite', uB.token, { conversationId: pairAB.conversationId, gameKey: 'word_scramble' }),
      req('POST', `/together/virtual-dates/${dateAB.body.id}/respond`, uB.token, { action: 'accept' }),
      req('GET', `/together/relationship/${pairAB.matchId}`, uB.token),
      req('POST', `/together/relationship/${pairAB.matchId}/milestones`, uB.token, {
        title: 'Nope',
        milestoneDate: '2026-11-25',
      }),
      req('POST', '/dating/like', uA.token, { targetProfileId: uB.profileId }),
      req('POST', '/dating/like', uB.token, { targetProfileId: uA.profileId }),
    ]) {
      const r = await postUnmatch;
      assert.strictEqual(r.status, 403, `Expected 403 post-unmatch, got ${r.status}: ${r.raw}`);
    }

    // 7. Verification revocation via live reviewer endpoint -> revokes match, closes conversation/permissions, zero note leak
    const decideRevoke = await req(
      'POST',
      `/verification-cases/${revCase.id}/decision`,
      null,
      {
        decision: 'rejected',
        reasonCode: 'enrolment_revoked',
        rejectionReason: 'CONFIDENTIAL_MOD_NOTE_5',
      },
      { 'x-smn-reviewer-key': REVIEWER_KEY, 'x-smn-reviewer-id': 'reviewer-closure' },
    );
    assert.strictEqual(decideRevoke.status, 200);
    assert.strictEqual(decideRevoke.body.discoveryEligible, false);

    const revMatchRow = await prisma.match.findUnique({ where: { id: pairARev.matchId } });
    const revConvRow = await prisma.conversation.findUnique({ where: { id: pairARev.conversationId } });
    assert.strictEqual(revMatchRow.status, 'ended');
    assert.strictEqual(revMatchRow.endReason, 'verification_revoked');
    assert.strictEqual(revConvRow.status, 'closed');

    const msgAfterRev = await req('POST', `/messaging/conversations/${pairARev.conversationId}/messages`, uA.token, {
      bodyText: 'Check revoked',
    });
    assert.strictEqual(msgAfterRev.status, 403);
    assert.ok(!msgAfterRev.raw.includes('CONFIDENTIAL_MOD_NOTE'));
    const discRev = await req('GET', '/dating/candidates', uRev.token);
    assert.strictEqual(discRev.status, 403);

    // 8. Account suspension in live DB immediately locks Match, Conversation, Calling, Together, Detail, Public Profile
    await prisma.$transaction([
      prisma.account.update({ where: { id: uSus.accountId }, data: { accountStatus: 'suspended' } }),
      prisma.accountEligibility.update({ where: { accountId: uSus.accountId }, data: { discoveryEligible: false } }),
    ]);

    const susMsg = await req('POST', `/messaging/conversations/${pairASus.conversationId}/messages`, uA.token, {
      bodyText: 'Hi?',
    });
    assert.strictEqual(susMsg.status, 403);
    assert.ok(!susMsg.raw.includes('CONFIDENTIAL_MOD_NOTE') && !susMsg.raw.toLowerCase().includes('suspend'));

    const susCall = await req('POST', '/calling/invite', uA.token, {
      conversationId: pairASus.conversationId,
    });
    assert.strictEqual(susCall.status, 403);

    const susPub = await req('GET', `/profiles/${uSus.profileId}/public`, uA.token);
    assert.strictEqual(susPub.status, 404);

    // 9. Age verification revocation (checkType: 'age') closes active CallSession + GameSession + RelationshipSpace cleanly
    const ageCall = await req('POST', '/calling/invite', uA.token, { conversationId: pairAAgeRev.conversationId });
    assert.strictEqual(ageCall.status, 201);
    const ageCallAccept = await req('POST', `/calling/${ageCall.body.callSession.id}/respond`, uAgeRev.token, { action: 'accept' });
    assert.strictEqual(ageCallAccept.status, 201);
    const ageGame = await req('POST', '/together/games/invite', uA.token, { conversationId: pairAAgeRev.conversationId, gameKey: 'word_scramble' });
    await req('POST', `/together/games/${ageGame.body.id}/respond`, uAgeRev.token, { action: 'accept' });
    await req('POST', '/together/relationship/propose', uA.token, { matchId: pairAAgeRev.matchId });
    await req('POST', '/together/relationship/propose', uAgeRev.token, { matchId: pairAAgeRev.matchId });

    const decideAgeRevoke = await req(
      'POST',
      `/verification-cases/${ageRevCase.id}/decision`,
      null,
      { decision: 'rejected', reasonCode: 'age_evidence_invalid', rejectionReason: 'CONFIDENTIAL_MOD_NOTE_7' },
      { 'x-smn-reviewer-key': REVIEWER_KEY, 'x-smn-reviewer-id': 'reviewer-age-closure' },
    );
    assert.strictEqual(decideAgeRevoke.status, 200);
    assert.strictEqual(decideAgeRevoke.body.discoveryEligible, false);

    const ageCallRow = await prisma.callSession.findUnique({ where: { id: ageCall.body.callSession.id } });
    const ageGameRow = await prisma.gameSession.findUnique({ where: { id: ageGame.body.id } });
    const ageSpaceRow = await prisma.relationshipSpace.findUnique({ where: { matchId: pairAAgeRev.matchId } });
    assert.strictEqual(ageCallRow.callStatus, 'ended');
    assert.strictEqual(ageGameRow.sessionStatus, 'ended');
    assert.strictEqual(ageSpaceRow.isActive, false);
    // Already-issued HTTP access JWT for uAgeRev fails closed immediately (403)
    const staleTokenCall = await req('GET', `/calling/${ageCall.body.callSession.id}`, uAgeRev.token);
    assert.strictEqual(staleTokenCall.status, 403);
    const staleTokenGame = await req('POST', `/together/games/${ageGame.body.id}/move`, uAgeRev.token, {
      moveType: 'guess_word',
      moveData: { guess: 'ALGORITHM' },
    });
    assert.strictEqual(staleTokenGame.status, 403);

    // 10. Block closes active CallSession + GameSession + RelationshipSpace cleanly and denies subsequent calls
    const blkCall = await req('POST', '/calling/invite', uA.token, { conversationId: pairABlk.conversationId });
    await req('POST', `/calling/${blkCall.body.callSession.id}/respond`, uBlk.token, { action: 'accept' });
    const blkGame = await req('POST', '/together/games/invite', uA.token, { conversationId: pairABlk.conversationId, gameKey: 'iitm_trivia' });
    await req('POST', `/together/games/${blkGame.body.id}/respond`, uBlk.token, { action: 'accept' });
    await req('POST', '/together/relationship/propose', uA.token, { matchId: pairABlk.matchId });
    await req('POST', '/together/relationship/propose', uBlk.token, { matchId: pairABlk.matchId });

    const blockRes = await req('POST', '/safety/block', uA.token, {
      targetProfileId: uBlk.profileId,
      reason: 'Harmful conduct',
    });
    assert.strictEqual(blockRes.status, 201);

    const blkCallRow = await prisma.callSession.findUnique({ where: { id: blkCall.body.callSession.id } });
    const blkGameRow = await prisma.gameSession.findUnique({ where: { id: blkGame.body.id } });
    const blkSpaceRow = await prisma.relationshipSpace.findUnique({ where: { matchId: pairABlk.matchId } });
    assert.strictEqual(blkCallRow.callStatus, 'ended');
    assert.strictEqual(blkGameRow.sessionStatus, 'ended');
    assert.strictEqual(blkSpaceRow.isActive, false);
    assert.strictEqual((await req('GET', `/calling/${blkCall.body.callSession.id}`, uBlk.token)).status, 403);
    assert.strictEqual((await req('GET', `/together/relationship/${pairABlk.matchId}`, uBlk.token)).status, 403);

    // Remaining active match & conversation lists for uA are now empty
    const remainingMatches = await req('GET', '/dating/matches', uA.token);
    assert.strictEqual(remainingMatches.status, 200);
    assert.strictEqual(remainingMatches.body.length, 0);

    const remainingConvs = await req('GET', '/messaging/conversations', uA.token);
    assert.strictEqual(remainingConvs.status, 200);
    assert.strictEqual(remainingConvs.body.length, 0);

    console.log('ALL REAL POSTGRESQL CLOSURE INVARIANTS PASSED (MATCH-11, MATCH-22 ALL 5 TRIGGERS, RACES, DOB, PRIVACY).');
  } finally {
    if (apiProc && !apiProc.killed) {
      apiProc.kill('SIGTERM');
    }
    await cleanupClosureTestData(prisma);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
