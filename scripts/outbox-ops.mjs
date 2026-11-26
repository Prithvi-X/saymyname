#!/usr/bin/env node
/**
 * Safe Local Outbox Inspection & Dead-Letter Recovery CLI (Phase 3.5.1)
 *
 * Strictly local operator CLI (never exposed via HTTP). Inspects status counts
 * and failed/expired outbox leases without printing private message text or PII,
 * and allows safe idempotent replay of dead-lettered events back to `pending`.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/outbox-ops.mjs inspect
 *   DATABASE_URL=... node scripts/outbox-ops.mjs replay <eventUuid>
 *   DATABASE_URL=... node scripts/outbox-ops.mjs replay-failed
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const [cmd = 'inspect', targetId] = process.argv.slice(2);
  const dbUrl = process.env.DATABASE_URL || process.env.AUDIT_DATABASE_URL;
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or AUDIT_DATABASE_URL.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    if (cmd === 'inspect') {
      const grouped = await prisma.outboxEvent.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      const failedOrStuck = await prisma.outboxEvent.findMany({
        where: {
          OR: [
            { status: 'failed' },
            { status: 'processing', lockedUntil: { lte: new Date() } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
        select: {
          id: true,
          aggregateType: true,
          aggregateId: true,
          eventType: true,
          status: true,
          retryCount: true,
          lastErrorCode: true,
          lastErrorAt: true,
          nextAttemptAt: true,
          lockedBy: true,
          lockedUntil: true,
          createdAt: true,
        },
      });
      console.log(
        JSON.stringify(
          {
            counts: grouped.map((g) => ({ status: g.status, count: g._count._all })),
            actionableEvents: failedOrStuck,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (cmd === 'replay') {
      if (!targetId || !UUID_RE.test(targetId)) {
        console.error('Provide a valid UUID: node scripts/outbox-ops.mjs replay <eventUuid>');
        process.exit(1);
      }
      const res = await prisma.outboxEvent.updateMany({
        where: { id: targetId, status: { in: ['failed', 'pending'] } },
        data: {
          status: 'pending',
          retryCount: 0,
          nextAttemptAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
        },
      });
      console.log(JSON.stringify({ replayedCount: res.count, eventId: targetId }));
      return;
    }

    if (cmd === 'replay-failed') {
      const res = await prisma.outboxEvent.updateMany({
        where: { status: 'failed' },
        data: {
          status: 'pending',
          retryCount: 0,
          nextAttemptAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
        },
      });
      console.log(JSON.stringify({ replayedCount: res.count }));
      return;
    }

    console.error(`Unknown command: ${cmd}. Use inspect | replay <uuid> | replay-failed`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('outbox-ops error:', err?.message || err);
  process.exit(1);
});
