/**
 * Phase 3.5.1 Real PostgreSQL + Real Redis Outbox Relay E2E Verification
 *
 * Exercises:
 * - Real PostgreSQL `FOR UPDATE SKIP LOCKED` multi-worker claiming across 2 workers
 * - Real Redis Pub/Sub cross-instance WS delivery
 * - Transient Redis failure (`docker stop saymyname-redis` -> send while down -> `pending` backlog -> `docker start saymyname-redis` -> automatic recovery to `published` + WS sync)
 * - Crashed worker lease expiry & reclaim by surviving worker
 * - Unmatch race suppression (`suppressed` status)
 * - Poison payload dead-lettering (`failed`) & `scripts/outbox-ops.mjs inspect` / `replay`
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { MatchAuthorizationService } = require('../services/api/dist/src/modules/safety/match-authorization.service');
const { RealtimeEventBusService } = require('../services/api/dist/src/modules/realtime/realtime-event-bus.service');
const { MessagingOutboxRelayService } = require('../services/api/dist/src/modules/realtime/messaging-outbox-relay.service');
const { MessagingService } = require('../services/api/dist/src/modules/messaging/messaging.service');

const DB_URL =
  process.env.AUDIT_DATABASE_URL ||
  'postgresql://saymyname_user:saymyname_password@localhost:5433/saymyname_phase32_audit?schema=public';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function uid(n) {
  return `35100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

async function waitUntil(fn, timeoutMs = 15000, label = 'condition') {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const val = await fn();
      if (val) return val;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for ${label} (${timeoutMs}ms)${lastErr ? `: ${lastErr.message}` : ''}`);
}

async function main() {
  process.env.NODE_ENV = 'development';
  process.env.DISABLE_REDIS = 'false';
  process.env.REDIS_URL = REDIS_URL;
  process.env.OUTBOX_RETRY_BASE_MS = '250';
  process.env.OUTBOX_RETRY_MAX_MS = '1000';
  process.env.OUTBOX_LEASE_MS = '600';
  process.env.OUTBOX_POLL_INTERVAL_MS = '200';
  process.env.OUTBOX_MAX_ATTEMPTS = '6';

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const matchAuth = new MatchAuthorizationService(prisma);

  const bus1 = new RealtimeEventBusService();
  const bus2 = new RealtimeEventBusService();
  const busSub = new RealtimeEventBusService();

  const receivedBySub = [];
  const unsubscribe = busSub.subscribe((ev) => {
    receivedBySub.push(ev);
  });

  // 2 competing outbox relay workers against real PG FOR UPDATE SKIP LOCKED
  const relay1 = new MessagingOutboxRelayService(prisma, matchAuth, bus1, 'pg-w1');
  const relay2 = new MessagingOutboxRelayService(prisma, matchAuth, bus2, 'pg-w2');
  const messaging = new MessagingService(prisma, matchAuth, undefined, bus1, undefined, relay1);

  const userA = uid(101);
  const userB = uid(102);
  const profileA = uid(201);
  const profileB = uid(202);
  const matchId = uid(301);
  const convId = uid(401);

  try {
    // Wait deterministically for Redis pub/sub readiness across instances
    await waitUntil(
      () =>
        bus1.pubClient?.status === 'ready' &&
        bus2.pubClient?.status === 'ready' &&
        busSub.subClient?.status === 'ready',
      10000,
      'Redis pub/sub initial ready across bus1, bus2, busSub',
    );

    // Seed clean isolated fixture users + active match + active conversation
    await prisma.$executeRawUnsafe(`DELETE FROM platform.outbox_events WHERE aggregate_id = '${convId}'::uuid`);
    await prisma.$executeRawUnsafe(`DELETE FROM messaging.messages WHERE conversation_id = '${convId}'::uuid`);
    await prisma.$executeRawUnsafe(`DELETE FROM messaging.conversation_members WHERE conversation_id = '${convId}'::uuid`);
    await prisma.$executeRawUnsafe(`DELETE FROM messaging.conversations WHERE id = '${convId}'::uuid`);
    await prisma.$executeRawUnsafe(`DELETE FROM dating.match_state_events WHERE match_id = '${matchId}'::uuid`);
    await prisma.$executeRawUnsafe(`DELETE FROM dating.matches WHERE id = '${matchId}'::uuid`);

    const seedUser = async (accId, profId, email, name) => {
      await prisma.account.upsert({
        where: { id: accId },
        create: {
          id: accId,
          authSubject: accId,
          email,
          accountStatus: 'active',
          emailVerifiedAt: new Date(),
          displayName: name,
        },
        update: { accountStatus: 'active', deletedAt: null },
      });
      await prisma.accountEligibility.upsert({
        where: { accountId: accId },
        create: {
          accountId: accId,
          ageStatus: 'approved',
          studentStatus: 'approved',
          discoveryEligible: true,
          dateOfBirth: new Date('2003-03-10T00:00:00Z'),
          programmeFamily: 'data_science_applications',
          pathwayCode: 'foundation_entry',
        },
        update: {
          ageStatus: 'approved',
          studentStatus: 'approved',
          discoveryEligible: true,
        },
      });
      await prisma.profile.upsert({
        where: { id: profId },
        create: {
          id: profId,
          accountId: accId,
          displayName: name,
          bio: 'Outbox test user',
          programmeFamily: 'data_science_applications',
          termOrYear: 'Diploma Level',
          intention: 'Long-term connection',
          locationCity: 'Chennai',
          locationState: 'Tamil Nadu',
          isPublished: true,
          isPaused: false,
          profileStatus: 'live',
          publishedAt: new Date(),
        },
        update: { isPublished: true, isPaused: false, profileStatus: 'live' },
      });
    };

    await seedUser(userA, profileA, 'outbox-a@ds.study.iitm.ac.in', 'Outbox Alpha');
    await seedUser(userB, profileB, 'outbox-b@ds.study.iitm.ac.in', 'Outbox Beta');

    const [low, high] = userA < userB ? [userA, userB] : [userB, userA];
    await prisma.match.create({
      data: {
        id: matchId,
        userLowId: low,
        userHighId: high,
        status: 'active',
      },
    });
    await prisma.conversation.create({
      data: {
        id: convId,
        matchId,
        status: 'active',
        members: {
          create: [
            { accountId: userA, lastReadSeq: BigInt(0), lastDeliveredSeq: BigInt(0) },
            { accountId: userB, lastReadSeq: BigInt(0), lastDeliveredSeq: BigInt(0) },
          ],
        },
      },
    });

    // 1. Concurrent FOR UPDATE SKIP LOCKED across relay1 & relay2 (5 queued events)
    for (let i = 1; i <= 5; i++) {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          payload: {
            conversationId: convId,
            messageId: uid(900 + i),
            sequenceNo: i,
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          status: 'pending',
          retryCount: 0,
          nextAttemptAt: new Date(Date.now() - 100),
        },
      });
    }

    const [s1, s2] = await Promise.all([
      relay1.processNextBatch(),
      relay2.processNextBatch(),
    ]);
    assert.strictEqual(s1.claimed + s2.claimed, 5, 'FOR UPDATE SKIP LOCKED must split or assign 5 rows without double claiming');
    assert.strictEqual(s1.published + s2.published, 5, 'All 5 rows must publish once across Redis');

    await waitUntil(
      () => receivedBySub.filter((e) => e.conversationId === convId && e.envelope?.eventType === 'message.created').length >= 5,
      8000,
      'cross-instance Redis receipt for 5 concurrent outbox events',
    );
    const seqsReceived = receivedBySub
      .filter((e) => e.conversationId === convId && e.envelope?.data?.sequenceNo <= 5)
      .map((e) => e.envelope.data.sequenceNo);
    assert.strictEqual(new Set(seqsReceived).size, 5, 'Every event 1..5 delivered cleanly via Redis');

    // 2. Real Redis outage test: stop Redis container -> send real message -> PG keeps pending -> start Redis -> recovers automatically
    relay1.onModuleInit();
    execFileSync('docker', ['stop', 'saymyname-redis'], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 400));

    const msgDuringOutage = await messaging.sendMessage(userA, convId, {
      bodyText: 'Sent while Redis container was stopped',
    });
    assert.ok(msgDuringOutage.id);

    // Wait 1.1s while Redis is down; outbox row must NOT silently mark published
    await new Promise((r) => setTimeout(r, 1100));
    const rowsWhileDown = await prisma.outboxEvent.findMany({
      where: { aggregateId: convId, eventType: 'message.created' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    assert.strictEqual(rowsWhileDown.length, 1);
    assert.notStrictEqual(rowsWhileDown[0].status, 'published', 'Cannot mark published while Redis is stopped');
    assert.ok(rowsWhileDown[0].retryCount >= 1);

    // Start Redis back up -> persistent retryStrategy + relay loop delivers without manual restart
    execFileSync('docker', ['start', 'saymyname-redis'], { stdio: 'ignore' });
    await waitUntil(async () => {
      const r = await prisma.outboxEvent.findUnique({ where: { id: rowsWhileDown[0].id } });
      return r?.status === 'published' && receivedBySub.some((e) => e.envelope?.data?.messageId === msgDuringOutage.id);
    }, 15000, 'Redis recovery and outbox automatic publish + sub receipt');
    await relay1.onModuleDestroy();

    // 3. Crashed worker lease expiry & reclaim on real PG
    const expiredId = uid(950);
    await prisma.outboxEvent.create({
      data: {
        id: expiredId,
        aggregateType: 'conversation',
        aggregateId: convId,
        eventType: 'message.created',
        payload: {
          conversationId: convId,
          messageId: uid(951),
          sequenceNo: 20,
          messageType: 'text',
          createdAt: new Date().toISOString(),
        },
        status: 'processing',
        retryCount: 1,
        lockedBy: 'dead-worker:999:abcd',
        lockedUntil: new Date(Date.now() - 2000),
        nextAttemptAt: new Date(Date.now() - 2000),
      },
    });
    const reclaimStats = await relay2.processNextBatch();
    assert.strictEqual(reclaimStats.published, 1);
    const reclaimedRow = await prisma.outboxEvent.findUnique({ where: { id: expiredId } });
    assert.strictEqual(reclaimedRow.status, 'published');

    // 4. Poison payload -> dead-lettered 'failed' -> inspected & replayed via scripts/outbox-ops.mjs
    const poisonId = uid(960);
    await prisma.outboxEvent.create({
      data: {
        id: poisonId,
        aggregateType: 'conversation',
        aggregateId: convId,
        eventType: 'message.created',
        payload: { malformed: true, secretTextShouldNeverPrint: 'SECRET_PII_MARKER' },
        status: 'pending',
        retryCount: 0,
        nextAttemptAt: new Date(Date.now() - 100),
      },
    });
    const failStats = await relay2.processNextBatch();
    assert.strictEqual(failStats.failed, 1);

    const inspectOut = execFileSync(
      'node',
      ['scripts/outbox-ops.mjs', 'inspect'],
      { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' },
    );
    assert.ok(inspectOut.includes(poisonId));
    assert.strictEqual(inspectOut.includes('SECRET_PII_MARKER'), false, 'CLI inspect must NEVER expose payload/PII');

    // Fix payload in DB and replay via CLI
    await prisma.outboxEvent.update({
      where: { id: poisonId },
      data: {
        payload: {
          conversationId: convId,
          messageId: uid(961),
          sequenceNo: 21,
          messageType: 'text',
          createdAt: new Date().toISOString(),
        },
      },
    });
    const replayOut = execFileSync(
      'node',
      ['scripts/outbox-ops.mjs', 'replay', poisonId],
      { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' },
    );
    assert.ok(JSON.parse(replayOut).replayedCount === 1);
    const afterReplay = await relay2.processNextBatch();
    assert.strictEqual(afterReplay.published, 1);

    // 5. Unmatch race suppression before relay publish
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'unmatched', endedByAccountId: userA, endedAt: new Date() },
    });
    await prisma.conversation.update({
      where: { id: convId },
      data: { status: 'closed' },
    });
    const suppressedId = uid(970);
    await prisma.outboxEvent.create({
      data: {
        id: suppressedId,
        aggregateType: 'conversation',
        aggregateId: convId,
        eventType: 'message.created',
        payload: {
          conversationId: convId,
          messageId: uid(971),
          sequenceNo: 22,
          messageType: 'text',
          createdAt: new Date().toISOString(),
        },
        status: 'pending',
        retryCount: 0,
        nextAttemptAt: new Date(Date.now() - 100),
      },
    });
    const supStats = await relay2.processNextBatch();
    assert.strictEqual(supStats.suppressed, 1);
    const supRow = await prisma.outboxEvent.findUnique({ where: { id: suppressedId } });
    assert.strictEqual(supRow.status, 'suppressed');
    assert.strictEqual(supRow.lastErrorCode, 'connection_closed');
    assert.strictEqual(
      receivedBySub.some((e) => e.envelope?.data?.messageId === uid(971)),
      false,
      'Suppressed event after unmatch must NOT publish to Redis subscribers',
    );

    console.log(
      JSON.stringify(
        {
          suite: 'phase3-5-1-outbox-e2e',
          status: 'PASS',
          concurrentSkipLockedClaimed: s1.claimed + s2.claimed,
          redisOutageRecoveredMessageId: msgDuringOutage.id,
          expiredLeaseReclaimed: true,
          cliInspectAndReplayPassed: true,
          unmatchRaceSuppressed: true,
        },
        null,
        2,
      ),
    );
  } finally {
    unsubscribe();
    // Clean up test fixture cleanly
    await prisma.$executeRawUnsafe(`DELETE FROM platform.outbox_events WHERE aggregate_id = '${convId}'::uuid`).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM messaging.messages WHERE conversation_id = '${convId}'::uuid`).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM messaging.conversation_members WHERE conversation_id = '${convId}'::uuid`).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM messaging.conversations WHERE id = '${convId}'::uuid`).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM dating.match_state_events WHERE match_id = '${matchId}'::uuid`).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM dating.matches WHERE id = '${matchId}'::uuid`).catch(() => null);

    await relay1.onModuleDestroy();
    await relay2.onModuleDestroy();
    await bus1.onModuleDestroy();
    await bus2.onModuleDestroy();
    await busSub.onModuleDestroy();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
