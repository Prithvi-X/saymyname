import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  extractSafeUrlsAndSegments,
  filterConversationsByQuery,
  formatVoiceDuration,
  markMessagesDeliveredUpTo,
  mergeChronologicalMessages,
  selectSupportedAudioRecordingMime,
  shouldGroupWithPrevious,
  sortConversationsDeterministically,
} from '../lib/chats-state.ts';
import type { ChatMessage, ConversationListItem } from '../lib/api.ts';
import { ProgrammeFamily } from '@saymyname/contracts';

const makeMsg = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  conversationId: 'c1',
  sequenceNo: 1,
  senderId: 'self',
  senderName: 'You',
  messageType: 'text',
  text: 'Hello',
  createdAt: '2026-11-26T00:00:00Z',
  createdAtIso: '2026-11-26T00:00:00Z',
  isOwn: true,
  deliveryState: 'sent',
  ...overrides,
});

describe('Chats State, Deduplication, Privacy & Audio Helpers (Phase 3.5)', () => {
  test('mergeChronologicalMessages deduplicates by id and clientAssignedUuid and orders by sequenceNo', () => {
    const optimistic = makeMsg({
      id: 'temp-1',
      clientAssignedUuid: 'uuid-1',
      sequenceNo: 999,
      localStatus: 'sending',
    });
    const m1 = makeMsg({ id: 'srv-1', sequenceNo: 1, text: 'First' });
    const m2 = makeMsg({
      id: 'srv-2',
      sequenceNo: 2,
      clientAssignedUuid: 'uuid-1',
      text: 'Second confirmed',
      localStatus: undefined,
    });
    const m2Dup = makeMsg({
      id: 'srv-2',
      sequenceNo: 2,
      deliveryState: 'delivered',
      text: 'Second confirmed',
    });

    const merged = mergeChronologicalMessages([optimistic, m1], [m2, m2Dup]);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((m) => m.id),
      ['srv-1', 'srv-2'],
    );
    assert.equal(merged[1].deliveryState, 'delivered');
  });

  test('markMessagesDeliveredUpTo only transitions own sent messages up to seq without exposing read receipts', () => {
    const msgs = [
      makeMsg({ id: 'm1', sequenceNo: 1, isOwn: true, deliveryState: 'sent' }),
      makeMsg({ id: 'm2', sequenceNo: 2, isOwn: true, deliveryState: 'sent' }),
      makeMsg({ id: 'm3', sequenceNo: 3, isOwn: false, deliveryState: 'sent' }),
      makeMsg({ id: 'm4', sequenceNo: 4, isOwn: true, deliveryState: 'sent' }),
    ];

    const updated = markMessagesDeliveredUpTo(msgs, 2);
    assert.equal(updated[0].deliveryState, 'delivered');
    assert.equal(updated[1].deliveryState, 'delivered');
    assert.equal(updated[2].deliveryState, 'sent');
    assert.equal(updated[3].deliveryState, 'sent');
  });

  test('sortConversationsDeterministically and filterConversationsByQuery order and match cleanly', () => {
    const convs: ConversationListItem[] = [
      {
        conversationId: 'c1',
        matchId: 'm1',
        matchedAt: '2026-11-25T10:00:00Z',
        lastMessageAt: '2026-11-26T00:00:00Z',
        lastMessage: {
          id: 'msg1',
          sequenceNo: 1,
          messageType: 'text',
          previewText: 'Linear algebra notes ready',
          isOwn: false,
          createdAt: '2026-11-26T00:00:00Z',
        },
        unreadCount: 2,
        latestSequenceNo: 1,
        ownLastReadSeq: 0,
        profile: {
          profileId: 'p1',
          displayName: 'Kavya Nair',
          age: 22,
          programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
          bio: '',
          photos: [],
          interests: [],
          promptAnswers: [],
        },
      },
      {
        conversationId: 'c2',
        matchId: 'm2',
        matchedAt: '2026-11-25T10:00:00Z',
        lastMessageAt: '2026-11-26T01:00:00Z',
        lastMessage: null,
        unreadCount: 0,
        latestSequenceNo: 0,
        ownLastReadSeq: 0,
        profile: {
          profileId: 'p2',
          displayName: 'Rohan Mehta',
          age: null,
          programmeFamily: ProgrammeFamily.ELECTRONIC_SYSTEMS,
          bio: '',
          locationCity: 'Pune',
          photos: [],
          interests: [],
          promptAnswers: [],
        },
      },
    ];

    const sorted = sortConversationsDeterministically(convs);
    assert.deepEqual(
      sorted.map((c) => c.conversationId),
      ['c2', 'c1'],
    );
    assert.equal(filterConversationsByQuery(sorted, 'linear').length, 1);
    assert.equal(filterConversationsByQuery(sorted, 'pune')[0].conversationId, 'c2');
  });

  test('extractSafeUrlsAndSegments blocks javascript URLs and keeps https links safe', () => {
    const segs = extractSafeUrlsAndSegments(
      'Check https://study.iitm.ac.in/ds and javascript:alert(1) safely',
    );
    const links = segs.filter((s) => s.type === 'link');
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'https://study.iitm.ac.in/ds');
    assert.equal(
      segs.some((s) => s.type === 'link' && s.content.includes('javascript:')),
      false,
    );
  });

  test('selectSupportedAudioRecordingMime, formatVoiceDuration, and grouping behave predictably', () => {
    assert.equal(formatVoiceDuration(60), '1:00');
    assert.equal(formatVoiceDuration(7), '0:07');

    const picked = selectSupportedAudioRecordingMime(
      (mime) => mime === 'audio/ogg;codecs=opus',
    );
    assert.deepEqual(picked, {
      mimeType: 'audio/ogg;codecs=opus',
      baseMime: 'audio/ogg',
      extension: 'ogg',
    });

    const a = makeMsg({ id: 'a', isOwn: true, createdAtIso: '2026-11-26T01:00:00Z' });
    const b = makeMsg({ id: 'b', isOwn: true, createdAtIso: '2026-11-26T01:02:00Z' });
    const c = makeMsg({ id: 'c', isOwn: false, createdAtIso: '2026-11-26T01:03:00Z' });
    assert.equal(shouldGroupWithPrevious(a, b), true);
    assert.equal(shouldGroupWithPrevious(b, c), false);
  });
});
