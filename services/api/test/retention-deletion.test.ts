import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { IdentityService } from '../src/modules/identity/identity.service';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import { RetentionPurgeService } from '../src/modules/retention/retention-purge.service';

describe('Phase 5: Account Deletion, Safety Legal Hold & Retention Purge', () => {
  test('IdentityService.deleteAccount enforces step-up confirmation and revokes account immediately', async () => {
    const cryptoSvc = new CryptoService();
    const pwHash = await cryptoSvc.hashPasswordAsync('ValidPhase5Pass!');
    let updatedAccountData: any = null;
    let revokedSessions = false;

    const prismaMock: any = {
      account: {
        findUnique: async () => ({
          id: 'acc-del-1',
          passwordHash: pwHash,
          accountStatus: 'active',
          deletedAt: null,
        }),
        update: async (args: any) => {
          updatedAccountData = args.data;
          return { id: 'acc-del-1', ...args.data };
        },
      },
      appSession: {
        updateMany: async () => {
          revokedSessions = true;
          return { count: 2 };
        },
      },
      accountEligibility: { updateMany: async () => ({ count: 1 }) },
      profile: { updateMany: async () => ({ count: 1 }) },
      match: { findMany: async () => [] },
      auditEvent: { create: async () => ({}) },
      $transaction: async (fn: any) => fn(prismaMock),
    };

    const identity = new IdentityService(
      prismaMock,
      cryptoSvc,
      {} as any,
      undefined,
      undefined,
    );

    await assert.rejects(
      () =>
        identity.deleteAccount('acc-del-1', {
          confirmPhrase: 'WRONG',
          password: 'ValidPhase5Pass!',
        }),
      (e: any) => e.status === 400,
    );

    await assert.rejects(
      () =>
        identity.deleteAccount('acc-del-1', {
          confirmPhrase: 'DELETE MY ACCOUNT',
          password: 'WrongPassword!',
        }),
      (e: any) => e.status === 401,
    );

    const res = await identity.deleteAccount('acc-del-1', {
      confirmPhrase: 'DELETE MY ACCOUNT',
      password: 'ValidPhase5Pass!',
    });

    assert.strictEqual(res.deleted, true);
    assert.strictEqual(res.graceDays, 30);
    assert.strictEqual(updatedAccountData.accountStatus, 'disabled');
    assert.ok(updatedAccountData.deletedAt instanceof Date);
    assert.strictEqual(revokedSessions, true);
  });

  test('SafetyService.reportUser stamps 180-day legalHoldUntil and pins ReportEvidenceRef media', async () => {
    let createdReport: any = null;
    let createdEvidence: any[] = [];

    const prismaMock: any = {
      profile: {
        findUnique: async () => ({ accountId: 'acc-reported-1' }),
      },
      message: {
        findUnique: async () => ({
          id: 'msg-ev-1',
          conversationId: 'conv-ev-1',
          conversation: {
            members: [{ accountId: 'acc-reporter-1' }, { accountId: 'acc-reported-1' }],
          },
        }),
      },
      report: {
        findFirst: async () => null,
        create: async (args: any) => {
          createdReport = { id: 'rep-1', ...args.data };
          return createdReport;
        },
      },
      messageMedia: {
        findMany: async () => [
          { s3Key: 'voice-notes/conv-ev-1/clip-1.webm', mediaType: 'voice_note' },
        ],
      },
      reportEvidenceRef: {
        createMany: async (args: any) => {
          createdEvidence = args.data;
          return { count: args.data.length };
        },
      },
    };

    const safety = new SafetyService(prismaMock);
    const out = await safety.reportUser('acc-reporter-1', {
      reportedId: 'acc-reported-1',
      conversationId: 'conv-ev-1',
      messageId: 'msg-ev-1',
      reportCategory: 'harassment',
      description: 'Voice harassment',
    });

    assert.strictEqual(out.success, true);
    assert.ok(createdReport.legalHoldUntil instanceof Date);
    const holdDays = (createdReport.legalHoldUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    assert.ok(holdDays > 179 && holdDays <= 181);
    assert.strictEqual(createdEvidence.length, 1);
    assert.strictEqual(createdEvidence[0].s3Key, 'voice-notes/conv-ev-1/clip-1.webm');
    assert.ok(createdEvidence[0].retentionUntil instanceof Date);
  });

  test('RetentionPurgeService purges expired unheld data while sparing active 180-day legal holds', async () => {
    let deletedConvIds: string[] = [];
    let anonymizedAccountId: string | null = null;
    let deletedAuditEvents: string[] = [];

    const prismaMock: any = {
      report: {
        findMany: async () => [
          {
            reporterId: 'acc-reporter',
            reportedId: 'acc-held-deleted',
            conversationId: 'conv-held',
            messageId: 'msg-held',
            status: 'pending',
            legalHoldUntil: new Date(Date.now() + 180 * 86400_000),
            evidence: [{ s3Key: 'voice/held.webm', retentionUntil: new Date(Date.now() + 180 * 86400_000) }],
          },
        ],
      },
      userBlock: {
        findMany: async () => [
          { blockerId: 'u-blk-1', blockedId: 'u-blk-2' },
        ],
      },
      match: {
        findMany: async () => [
          { id: 'm-purge', userLowId: 'u1', userHighId: 'u2', status: 'ended', endReason: 'unmatched', endedAt: new Date(Date.now() - 40 * 86400_000), conversation: { id: 'conv-purge' } },
          { id: 'm-block-wait', userLowId: 'u-blk-1', userHighId: 'u-blk-2', status: 'ended', endReason: 'User blocked: safety', endedAt: new Date(Date.now() - 40 * 86400_000), conversation: { id: 'conv-block-wait' } },
          { id: 'm-held', userLowId: 'acc-reporter', userHighId: 'acc-held-deleted', status: 'ended', endReason: 'User blocked', endedAt: new Date(Date.now() - 100 * 86400_000), conversation: { id: 'conv-held' } },
        ],
      },
      message: {
        count: async () => 2,
        deleteMany: async (args: any) => {
          if (args.where.conversationId) deletedConvIds.push(args.where.conversationId);
          return { count: 2 };
        },
      },
      messageMedia: {
        findMany: async () => [{ id: 'mm-1', s3Key: 'voice/unheld.webm', messageId: 'm1' }],
        deleteMany: async () => ({ count: 1 }),
      },
      account: {
        findMany: async () => [
          {
            id: 'acc-unheld-deleted',
            profile: { id: 'prof-unheld', photos: [{ id: 'ph-1', s3Key: 'photos/old.jpg' }] },
          },
          {
            id: 'acc-held-deleted',
            profile: { id: 'prof-held', photos: [{ id: 'ph-2', s3Key: 'photos/held.jpg' }] },
          },
        ],
        update: async (args: any) => {
          anonymizedAccountId = args.where.id;
          return { id: args.where.id, ...args.data };
        },
      },
      profilePhoto: { deleteMany: async () => ({ count: 1 }) },
      profileInterest: { deleteMany: async () => ({ count: 0 }) },
      profilePromptAnswer: { deleteMany: async () => ({ count: 0 }) },
      preferenceSetting: { deleteMany: async () => ({ count: 1 }) },
      profile: { deleteMany: async () => ({ count: 1 }) },
      appSession: { deleteMany: async () => ({ count: 1 }) },
      otpChallenge: { deleteMany: async () => ({ count: 1 }) },
      passwordResetToken: { deleteMany: async () => ({ count: 0 }) },
      userDevice: { deleteMany: async () => ({ count: 0 }) },
      notificationPreference: { deleteMany: async () => ({ count: 0 }) },
      auditEvent: {
        create: async (args: any) => {
          deletedAuditEvents.push(args.data.action);
          return {};
        },
      },
      $transaction: async (fn: any) => fn(prismaMock),
    };

    const prevR2 = process.env.R2_BUCKET_NAME;
    delete process.env.R2_BUCKET_NAME;
    try {
      const worker = new RetentionPurgeService(prismaMock);
      const summary = await worker.runRetentionSweep();

      assert.strictEqual(summary.purgedConversations, 1);
      assert.strictEqual(summary.purgedAccounts, 1);
      assert.strictEqual(summary.skippedLegalHoldCount, 2); // conv-held + acc-held-deleted
      assert.deepStrictEqual(deletedConvIds, ['conv-purge']);
      assert.strictEqual(anonymizedAccountId, 'acc-unheld-deleted');
      assert.ok(deletedAuditEvents.includes('retention.match_purged'));
      assert.ok(deletedAuditEvents.includes('retention.account_purged'));
      assert.ok(deletedAuditEvents.includes('retention.account_purge_deferred_legal_hold'));
    } finally {
      if (prevR2 !== undefined) process.env.R2_BUCKET_NAME = prevR2;
    }
  });
});
