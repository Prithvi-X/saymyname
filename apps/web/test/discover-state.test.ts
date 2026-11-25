import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import {
  formatCandidateHeading,
  formatCoarseLocation,
  formatProgrammeLabel,
  getInitials,
  mergeFeedBatch,
  removeCandidateById,
  REPORT_CATEGORY_OPTIONS,
} from '../lib/discover-state.ts';
import { ProgrammeFamily } from '../../../packages/contracts/dist/enums/index.js';

describe('Discover UI State & Formatting Safeguards (Phase 3.2)', () => {
  test('formatCandidateHeading never renders null or undefined when ageDisplayMode is hidden', () => {
    assert.strictEqual(formatCandidateHeading('Meera Nair', null), 'Meera Nair');
    assert.strictEqual(formatCandidateHeading('Meera Nair', undefined), 'Meera Nair');
    assert.strictEqual(formatCandidateHeading('Meera Nair', 17), 'Meera Nair');
    assert.strictEqual(formatCandidateHeading('Meera Nair', 22), 'Meera Nair, 22');
    assert.strictEqual(formatCandidateHeading('', null), 'Verified Peer');
  });

  test('formatProgrammeLabel covers all 4 approved IITM BS programmes exclusively', () => {
    assert.strictEqual(
      formatProgrammeLabel(ProgrammeFamily.DATA_SCIENCE_APPLICATIONS),
      'BS in Data Science and Applications',
    );
    assert.strictEqual(
      formatProgrammeLabel(ProgrammeFamily.ELECTRONIC_SYSTEMS),
      'BS in Electronic Systems',
    );
    assert.strictEqual(
      formatProgrammeLabel(ProgrammeFamily.AERONAUTICS_SPACE),
      'BS in Aeronautics and Space Technology',
    );
    assert.strictEqual(
      formatProgrammeLabel(ProgrammeFamily.MANAGEMENT_DATA_SCIENCE),
      'BS in Management and Data Science',
    );
  });

  test('formatCoarseLocation formats self-declared city/state without coordinates or distances', () => {
    assert.strictEqual(formatCoarseLocation('Chennai', 'Tamil Nadu'), 'Chennai, Tamil Nadu');
    assert.strictEqual(formatCoarseLocation('Bengaluru', null), 'Bengaluru');
    assert.strictEqual(formatCoarseLocation(null, null), null);
  });

  test('mergeFeedBatch deduplicates candidate batches cleanly without re-inserting seen profiles', () => {
    const c1: any = { profileId: 'p1', displayName: 'A', age: 21, programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS, bio: '', photos: [], interests: [], promptAnswers: [] };
    const c2: any = { profileId: 'p2', displayName: 'B', age: 22, programmeFamily: ProgrammeFamily.ELECTRONIC_SYSTEMS, bio: '', photos: [], interests: [], promptAnswers: [] };

    const merged = mergeFeedBatch([c1], {
      candidates: [c1, c2],
      nextCursor: 'cur-2',
      hasMore: true,
      count: 2,
      pageSize: 10,
      viewerState: 'ready',
    });
    assert.strictEqual(merged.length, 2);
    assert.deepStrictEqual(
      removeCandidateById(merged, 'p1').map((c) => c.profileId),
      ['p2'],
    );
  });

  test('REPORT_CATEGORY_OPTIONS aligns strictly with backend allowed report categories', () => {
    const values = REPORT_CATEGORY_OPTIONS.map((o) => o.value);
    assert.deepStrictEqual(values.sort(), [
      'fake_profile',
      'harassment',
      'inappropriate_content',
      'offline_safety',
      'spam',
      'underage_suspected',
    ]);
    assert.strictEqual(getInitials('Ananya Krishnan'), 'AK');
  });
});
