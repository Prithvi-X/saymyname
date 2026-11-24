import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { DatingService } from '../src/modules/dating/dating.service';
import { SafetyService } from '../src/modules/safety/safety.service';

describe('Phase 3 P0 Dating Loop & Match Invariants', () => {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';

  // In-memory mock database state
  const mockLikes: any[] = [];
  const mockMatches: any[] = [];
  const mockBlocks: any[] = [];

  const mockPrisma = {
    userBlock: {
      findMany: async () => mockBlocks,
      upsert: async (args: any) => {
        mockBlocks.push(args.create);
        return args.create;
      },
    },
    like: {
      findMany: async () => mockLikes,
      findFirst: async (args: any) => {
        return mockLikes.find(
          (l) => l.fromAccountId === args.where.fromAccountId && l.toAccountId === args.where.toAccountId && l.status === 'active'
        ) || null;
      },
      upsert: async (args: any) => {
        mockLikes.push(args.create);
        return { id: 'like-1', ...args.create };
      },
    },
    pass: {
      findMany: async () => [],
      upsert: async () => ({ id: 'pass-1' }),
    },
    profile: {
      findMany: async () => [],
    },
    match: {
      findUnique: async (args: any) => {
        const key = args.where.userLowId_userHighId;
        return mockMatches.find((m) => m.userLowId === key.userLowId && m.userHighId === key.userHighId) || null;
      },
      upsert: async (args: any) => {
        const record = { id: 'match-123', ...args.create, conversation: { id: 'conv-123' } };
        mockMatches.push(record);
        return record;
      },
      update: async (args: any) => {
        const m = mockMatches.find((match) => match.id === args.where.id);
        if (m) Object.assign(m, args.data);
        return m;
      },
      findMany: async () => mockMatches,
    },
    conversation: {
      update: async () => ({}),
    },
  };

  const datingService = new DatingService(mockPrisma as any);
  const safetyService = new SafetyService(mockPrisma as any);

  test('Rule 1: Unilateral Like does not create mutual match', async () => {
    const res = await datingService.sendLike(userA, { toAccountId: userB });
    assert.strictEqual(res.isMutualMatch, false);
    assert.strictEqual(res.message, 'Like sent successfully.');
  });

  test('Rule 2: Reciprocal Like triggers Mutual Match & Lexicographical Ordering (Doc 06 §6.3)', async () => {
    // User B likes User A back
    const res = await datingService.sendLike(userB, { toAccountId: userA });
    assert.strictEqual(res.isMutualMatch, true);
    assert.ok(res.matchId);
    assert.ok(res.conversationId);

    // Verify lexicographical ordering invariant: userLowId < userHighId
    const createdMatch = mockMatches[0];
    assert.strictEqual(createdMatch.userLowId, userA < userB ? userA : userB);
    assert.strictEqual(createdMatch.userHighId, userA < userB ? userB : userA);
  });

  test('Rule 3: Active matches query returns valid matched partner', async () => {
    const matches = await datingService.getMatches(userA);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].matchedAccountId, userB);
  });

  test('Rule 4: Bi-directional Block immediately ends match (Doc 04 §11)', async () => {
    const blockRes = await safetyService.blockUser(userA, {
      blockedId: userB,
      reason: 'Inappropriate conduct',
    });

    assert.strictEqual(blockRes.success, true);
    assert.strictEqual(mockMatches[0].status, 'ended');
    assert.ok(mockMatches[0].endedAt);
  });
});
