import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { TogetherService } from '../src/modules/together/together.service';
import { GameSessionStatus, VirtualDateStatus } from '@saymyname/contracts';

describe('TogetherService (Mini-Games, Virtual Dates & Relationship Mode)', () => {
  const mockPrisma: any = {};
  const togetherService = new TogetherService(mockPrisma);

  const userA = 'a1111111-1111-1111-1111-111111111111';
  const userB = 'a2222222-2222-2222-2222-222222222222';
  const conversationId = 'c1111111-1111-1111-1111-111111111111';
  const matchId = 'm1111111-1111-1111-1111-111111111111';

  it('lists active interactive mini-games catalog', () => {
    const games = togetherService.getGameCatalog();
    assert.ok(games.length >= 3);
    assert.ok(games.some((g) => g.gameKey === 'word_scramble'));
    assert.ok(games.some((g) => g.gameKey === 'iitm_trivia'));
    assert.ok(games.some((g) => g.gameKey === 'twenty_questions'));
  });

  it('invites partner to word scramble game and accepts invitation', async () => {
    const session = await togetherService.inviteGame(userA, {
      conversationId,
      gameKey: 'word_scramble',
    });

    assert.equal(session.sessionStatus, GameSessionStatus.INVITED);
    assert.equal(session.gameKey, 'word_scramble');
    assert.ok(session.currentState.scrambled);

    const activeSession = await togetherService.respondGame(userB, session.id, {
      action: 'accept',
    });

    assert.equal(activeSession.sessionStatus, GameSessionStatus.ACTIVE);
    assert.ok(activeSession.startedAt);
  });

  it('submits correct word guess move and awards points', async () => {
    const session = await togetherService.inviteGame(userA, {
      conversationId,
      gameKey: 'word_scramble',
    });
    await togetherService.respondGame(userB, session.id, { action: 'accept' });

    const moveRes = await togetherService.submitMove(userA, session.id, {
      moveType: 'guess_word',
      moveData: { guess: 'ALGORITHM' },
    });

    assert.equal(moveRes.currentState.lastCorrectGuess, 'ALGORITHM');
    assert.equal(moveRes.currentState.lastWinner, userA);
  });

  it('proposes virtual date and accepts invitation', async () => {
    const dateDto = await togetherService.proposeVirtualDate(userA, {
      conversationId,
      scheduledFor: '2026-12-05T19:00:00.000Z',
      timezone: 'Asia/Kolkata',
      activityType: 'study_session',
      proposalNotes: 'Let us prepare for algorithms midterm!',
    });

    assert.equal(dateDto.status, VirtualDateStatus.PROPOSED);
    assert.equal(dateDto.proposedById, userA);

    const acceptedDto = await togetherService.respondVirtualDate(userB, dateDto.id, {
      action: 'accept',
    });

    assert.equal(acceptedDto.status, VirtualDateStatus.ACCEPTED);

    const list = await togetherService.listVirtualDates(userA, conversationId);
    assert.ok(list.length >= 1);
  });

  it('enforces bilateral affirmative actions for Relationship Mode (Doc 01 §3.4)', async () => {
    // Single user proposal does NOT activate relationship space
    const propA = await togetherService.proposeRelationship(userA, { matchId });
    assert.equal(propA.proposed, true);
    assert.equal(propA.bilateralActivated, false);

    // Second affirmative action by partner activates relationship space!
    const propB = await togetherService.proposeRelationship(userB, { matchId });
    assert.equal(propB.proposed, true);
    assert.equal(propB.bilateralActivated, true);
    assert.ok(propB.space);
    assert.equal(propB.space.isActive, true);
  });

  it('adds and lists shared relationship milestones and private journals', async () => {
    const milestone = await togetherService.createMilestone(userA, matchId, {
      title: 'Our First Code Sprint Together',
      milestoneDate: '2026-11-24',
      description: 'Built the SayMyName backend together!',
    });

    assert.ok(milestone.id);
    assert.equal(milestone.title, 'Our First Code Sprint Together');

    const milestones = await togetherService.listMilestones(userB, matchId);
    assert.ok(milestones.length >= 2); // Initial auto milestone + user milestone

    const journal = await togetherService.createJournalEntry(userA, matchId, {
      entryText: 'Today was an unforgettable milestone.',
      entryDate: '2026-11-24',
    });

    assert.ok(journal.id);
    const journals = await togetherService.listJournalEntries(userB, matchId);
    assert.equal(journals.length, 1);
  });

  it('permits unilateral unpairing from Relationship Mode without partner permission (Doc 01 §3.4)', async () => {
    const leaveRes = await togetherService.leaveRelationship(userA, { matchId });
    assert.equal(leaveRes.success, true);
    assert.ok(leaveRes.disbandedAt);

    // Relationship space is no longer active
    await assert.rejects(
      async () => {
        await togetherService.getRelationshipSpace(userA, matchId);
      },
      {
        name: 'NotFoundException',
      },
    );
  });

  it('blocks inviter/proposer from self-accepting games, virtual dates, or relationship mode', async () => {
    const game = await togetherService.inviteGame(userA, {
      conversationId,
      gameKey: 'iitm_trivia',
    });
    assert.equal((game.currentState as any).correctIndex, undefined);
    await assert.rejects(
      () => togetherService.respondGame(userA, game.id, { action: 'accept' }),
      { name: 'ForbiddenException' },
    );

    const vDate = await togetherService.proposeVirtualDate(userA, {
      conversationId,
      scheduledFor: '2026-12-20T18:30:00.000Z',
      timezone: 'Asia/Kolkata',
      activityType: 'coffee_chat',
    });
    await assert.rejects(
      () => togetherService.respondVirtualDate(userA, vDate.id, { action: 'accept' }),
      { name: 'ForbiddenException' },
    );
    await assert.rejects(
      () =>
        togetherService.proposeVirtualDate(userA, {
          conversationId,
          scheduledFor: '2020-01-01T10:00:00.000Z',
          timezone: 'Asia/Kolkata',
          activityType: 'coffee_chat',
        }),
      { name: 'BadRequestException' },
    );

    const relMatchId = 'm2222222-2222-2222-2222-222222222222';
    await togetherService.proposeRelationship(userA, { matchId: relMatchId });
    const stPending = await togetherService.getRelationshipStatus(userA, relMatchId);
    assert.equal(stPending.proposalStatus, 'proposed');
    assert.equal(stPending.proposedById, userA);
    assert.equal(stPending.isActive, false);

    await assert.rejects(
      () => togetherService.respondRelationship(userA, { matchId: relMatchId, action: 'accept' }),
      { name: 'ForbiddenException' },
    );

    const relAccepted = await togetherService.respondRelationship(userB, {
      matchId: relMatchId,
      action: 'accept',
    });
    assert.equal(relAccepted.bilateralActivated, true);

    const stActive = await togetherService.getRelationshipStatus(userB, relMatchId);
    assert.equal(stActive.proposalStatus, 'active');
    assert.equal(stActive.isActive, true);
  });

  it('plays 20 Questions icebreaker cooperatively and supports ending game sessions', async () => {
    const qSession = await togetherService.inviteGame(userA, {
      conversationId,
      gameKey: 'twenty_questions',
    });
    await togetherService.respondGame(userB, qSession.id, { action: 'accept' });

    const r1A = await togetherService.submitMove(userA, qSession.id, {
      moveType: 'answer_prompt',
      moveData: { answer: 'Reading by Marina beach with filter coffee.' },
    });
    assert.equal(r1A.currentState.promptIndex, 0);
    assert.equal((r1A.currentState.responses as any[]).length, 1);

    const r1B = await togetherService.submitMove(userB, qSession.id, {
      moveType: 'answer_prompt',
      moveData: { answer: 'Long walks and indie playlists.' },
    });
    assert.equal(r1B.currentState.promptIndex, 1);
    assert.equal(r1B.members?.[0].score, 10);

    const ended = await togetherService.endGameSession(userA, qSession.id);
    assert.equal(ended.sessionStatus, GameSessionStatus.ABANDONED);

    const list = await togetherService.listGameSessions(userB, conversationId);
    assert.ok(list.some((s) => s.id === qSession.id));
  });
});
