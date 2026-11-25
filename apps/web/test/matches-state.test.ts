import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import {
  buildChatHrefForMatch,
  filterMatchesByQuery,
  formatMatchDate,
  getUnmatchDialogContent,
  removeMatchById,
  selectActiveMatch,
} from '../lib/matches-state.ts';
import type { MatchProfile } from '../lib/api.ts';
import { ProgrammeFamily } from '../../../packages/contracts/dist/enums/index.js';

function makeMatch(
  id: string,
  name: string,
  opts?: { conversationId?: string; city?: string; programme?: ProgrammeFamily },
): MatchProfile {
  return {
    id,
    conversationId: opts?.conversationId || `conv-${id}`,
    status: 'active',
    matchedAt: '2026-11-25T10:00:00.000Z',
    matchedAtIso: '2026-11-25T10:00:00.000Z',
    lastMessage: null,
    candidate: {
      profileId: `prof-${id}`,
      displayName: name,
      age: 22,
      ageVisible: true,
      programmeFamily: opts?.programme || ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      bio: `Bio for ${name}`,
      locationCity: opts?.city || 'Chennai',
      locationState: 'Tamil Nadu',
      photos: [],
      interests: ['Linear Algebra'],
      promptAnswers: [],
    },
  };
}

describe('Matches Workspace State & Safety Copy Safeguards (Phase 3.4)', () => {
  test('selectActiveMatch and removeMatchById preserve stable selection and advance cleanly on unmatch', () => {
    const m1 = makeMatch('m1', 'Aarav');
    const m2 = makeMatch('m2', 'Diya');
    const list = [m1, m2];

    assert.strictEqual(selectActiveMatch(list, null)?.id, 'm1');
    assert.strictEqual(selectActiveMatch(list, 'm2')?.id, 'm2');
    assert.strictEqual(selectActiveMatch(list, 'missing')?.id, 'm1');

    const remaining = removeMatchById(list, 'm1');
    assert.deepStrictEqual(
      remaining.map((m) => m.id),
      ['m2'],
    );
    assert.strictEqual(selectActiveMatch(remaining, 'm1')?.id, 'm2');
    assert.strictEqual(selectActiveMatch([], 'm1'), null);
  });

  test('filterMatchesByQuery filters case-insensitively across name, city, and programme', () => {
    const m1 = makeMatch('m1', 'Kavya Nair', { city: 'Bengaluru' });
    const m2 = makeMatch('m2', 'Rohan Mehta', {
      city: 'Pune',
      programme: ProgrammeFamily.ELECTRONIC_SYSTEMS,
    });
    assert.strictEqual(filterMatchesByQuery([m1, m2], 'bengal').length, 1);
    assert.strictEqual(filterMatchesByQuery([m1, m2], 'electronic').length, 1);
    assert.strictEqual(filterMatchesByQuery([m1, m2], 'kavya')[0].id, 'm1');
    assert.strictEqual(filterMatchesByQuery([m1, m2], '').length, 2);
  });

  test('buildChatHrefForMatch binds both matchId and conversationId safely', () => {
    const href = buildChatHrefForMatch({ id: 'match-uuid-1', conversationId: 'conv-uuid-9' });
    assert.strictEqual(href, '/chats?matchId=match-uuid-1&conversationId=conv-uuid-9');
  });

  test('getUnmatchDialogContent clearly distinguishes Unmatch from Block and Report', () => {
    const copy = getUnmatchDialogContent('Priya');
    assert.ok(copy.title.includes('Priya'));
    assert.ok(copy.description.toLowerCase().includes('close'));
    assert.ok(copy.explanation.toLowerCase().includes('not be automatically blocked'));
    assert.strictEqual(copy.cancelLabel, 'Keep Match');
    assert.strictEqual(copy.confirmLabel, 'Unmatch');
    assert.strictEqual(
      formatMatchDate('2026-11-25T05:00:00.000Z', new Date('2026-11-25T20:00:00.000Z')),
      'Today',
    );
  });
});
