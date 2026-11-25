import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import {
  formatLikesDateLabel,
  getSentLikeStatusMeta,
  markSentLikeWithdrawn,
  mergePaginatedByLikeId,
  removeLikeById,
} from '../lib/likes-state.ts';
import type { SentLikeItem } from '../lib/api.ts';

function buildSentItem(
  likeId: string,
  availability: SentLikeItem['availability'] = 'pending',
): SentLikeItem {
  return {
    likeId,
    status: availability === 'withdrawn' ? 'withdrawn' : 'active',
    availability,
    statusLabel: availability === 'withdrawn' ? 'Withdrawn' : 'Awaiting response',
    canWithdraw: availability !== 'withdrawn',
    sentAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    profile: {
      profileId: availability === 'unavailable' ? null : `prof-${likeId}`,
      displayName: availability === 'unavailable' ? 'Member unavailable' : `Peer ${likeId}`,
      age: availability === 'unavailable' ? null : 21,
      ageVisible: availability !== 'unavailable',
      programmeFamily: null,
      photos: [],
      interests: [],
      promptAnswers: [],
      isVerified: availability !== 'unavailable',
    },
  };
}

describe('Likes UI State & Non-Confidential Formatting Safeguards (Phase 3.3)', () => {
  test('mergePaginatedByLikeId deduplicates incremental batches and removes stale rows cleanly', () => {
    const a = buildSentItem('l1');
    const b = buildSentItem('l2');
    const c = buildSentItem('l3');

    const merged = mergePaginatedByLikeId([a, b], [b, c]);
    assert.deepStrictEqual(
      merged.map((i) => i.likeId),
      ['l1', 'l2', 'l3'],
    );
    assert.deepStrictEqual(
      removeLikeById(merged, 'l2').map((i) => i.likeId),
      ['l1', 'l3'],
    );
  });

  test('markSentLikeWithdrawn marks target withdrawn immutably and clears canWithdraw', () => {
    const items = [buildSentItem('l1'), buildSentItem('l2')];
    const updated = markSentLikeWithdrawn(items, 'l1', '2026-11-25T11:00:00.000Z');

    assert.strictEqual(items[0].canWithdraw, true);
    assert.strictEqual(updated[0].status, 'withdrawn');
    assert.strictEqual(updated[0].availability, 'withdrawn');
    assert.strictEqual(updated[0].canWithdraw, false);
    assert.strictEqual(updated[1].canWithdraw, true);
  });

  test('formatLikesDateLabel formats same-day, yesterday, and recent timestamps consistently', () => {
    const ref = new Date('2026-11-25T18:00:00.000Z');
    assert.strictEqual(formatLikesDateLabel('2026-11-25T05:00:00.000Z', ref), 'Today');
    assert.strictEqual(formatLikesDateLabel('2026-11-24T22:00:00.000Z', ref), 'Yesterday');
    assert.strictEqual(formatLikesDateLabel('2026-11-22T12:00:00.000Z', ref), '3 days ago');
    assert.strictEqual(formatLikesDateLabel('invalid-date', ref), 'Recently');
  });

  test('getSentLikeStatusMeta keeps unavailable state completely free of confidential reasons', () => {
    const unavailableMeta = getSentLikeStatusMeta(buildSentItem('l1', 'unavailable'));
    const lower = `${unavailableMeta.label} ${unavailableMeta.helperCopy}`.toLowerCase();
    assert.strictEqual(unavailableMeta.badgeVariant, 'warning');
    assert.strictEqual(lower.includes('block'), false);
    assert.strictEqual(lower.includes('suspend'), false);
    assert.strictEqual(lower.includes('pass'), false);
    assert.strictEqual(lower.includes('moderat'), false);
  });
});
