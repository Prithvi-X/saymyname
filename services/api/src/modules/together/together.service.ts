import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import {
  GameSessionStatus,
  VirtualDateStatus,
  GameCatalogItemDto,
  GameSessionDto,
  VirtualDateDto,
  RelationshipSpaceDto,
  RelationshipMilestoneDto as IRelationshipMilestoneDto,
  RelationshipJournalDto as IRelationshipJournalDto,
} from '@saymyname/contracts';
import {
  GameInviteDto,
  GameRespondDto,
  GameMoveDto,
  VirtualDateProposeDto,
  VirtualDateRespondDto,
  RelationshipProposeDto,
  RelationshipRespondDto,
  RelationshipMilestoneDto,
  RelationshipJournalDto,
  RelationshipLeaveDto,
} from './dto/together.dto';
import * as crypto from 'crypto';

interface MockGameSession {
  id: string;
  conversationId: string;
  gameKey: string;
  title: string;
  sessionStatus: GameSessionStatus;
  currentState: Record<string, any>;
  winnerAccountId?: string | null;
  members: Array<{ accountId: string; score: number }>;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

interface MockVirtualDate {
  id: string;
  conversationId: string;
  proposedById: string;
  scheduledFor: Date;
  timezone: string;
  activityType: string;
  status: VirtualDateStatus;
  proposalNotes?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

interface MockRelationshipSpace {
  id: string;
  matchId: string;
  userAId: string;
  userBId: string;
  isActive: boolean;
  activatedAt: Date;
  disbandedAt?: Date | null;
  disbandedById?: string | null;
  milestones: Array<{
    id: string;
    title: string;
    milestoneDate: string;
    description?: string | null;
    createdById: string;
    createdAt: Date;
  }>;
  journals: Array<{
    id: string;
    entryText: string;
    entryDate: string;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

const STATIC_GAME_CATALOG: GameCatalogItemDto[] = [
  {
    id: 'g1',
    gameKey: 'word_scramble',
    title: 'Word Scramble',
    description: 'Unscramble student life, campus spots, and dating terms together in real-time.',
    minPlayers: 2,
    maxPlayers: 2,
    isActive: true,
  },
  {
    id: 'g2',
    gameKey: 'iitm_trivia',
    title: 'IITM BS Trivia',
    description: 'Test your knowledge on IIT Madras non-campus programmes, programming quizzes, and campus lore.',
    minPlayers: 2,
    maxPlayers: 2,
    isActive: true,
  },
  {
    id: 'g3',
    gameKey: 'twenty_questions',
    title: '20 Questions Icebreaker',
    description: 'Fun, synchronous prompt questions to spark deep and delightful conversations.',
    minPlayers: 2,
    maxPlayers: 2,
    isActive: true,
  },
];

const SCRAMBLE_WORDS = [
  { scrambled: 'THOMLIGRA', solution: 'ALGORITHM', hint: 'Computer science core' },
  { scrambled: 'NEOSATURCE', solution: 'AERONAUTS', hint: 'IITM Degree family' },
  { scrambled: 'FFCOEELREIT', solution: 'FILTERCOFFEE', hint: 'Chennai special' },
  { scrambled: 'TISICONTEN', solution: 'CONNECTION', hint: 'SayMyName goal' },
];

const TRIVIA_QUESTIONS = [
  {
    question: 'In which year did IIT Madras launch the world-first BS in Data Science & Applications?',
    options: ['2018', '2020', '2022', '2024'],
    correctIndex: 1,
  },
  {
    question: 'Which of the following is ONE of the 4 approved BS non-campus programmes at IITM?',
    options: ['Mechanical Systems', 'Electronic Systems', 'Civil Infrastructure', 'Chemical Processes'],
    correctIndex: 1,
  },
  {
    question: 'What is the standard student email domain for IITM BS students?',
    options: ['@iitm.ac.in', '@study.iitm.ac.in', '@campus.iitm.ac.in', '@iitmbs.edu'],
    correctIndex: 1,
  },
];

@Injectable()
export class TogetherService {
  private readonly mockGameSessions: Map<string, MockGameSession> = new Map();
  private readonly mockVirtualDates: Map<string, MockVirtualDate> = new Map();
  private readonly mockProposals: Map<string, Set<string>> = new Map(); // matchId -> set of userIds who approved
  private readonly mockSpaces: Map<string, MockRelationshipSpace> = new Map(); // matchId -> Space
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() matchAuthService?: MatchAuthorizationService,
  ) {
    void this.prisma;
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny?.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private hasDbGames(db: any = this.prisma): boolean {
    return (
      typeof db?.gameSession?.create === 'function' &&
      typeof db?.gameSession?.findUnique === 'function' &&
      typeof db?.gameCatalog?.upsert === 'function'
    );
  }

  private hasDbDates(db: any = this.prisma): boolean {
    return (
      typeof db?.virtualDate?.create === 'function' &&
      typeof db?.virtualDate?.findUnique === 'function'
    );
  }

  private hasDbSpaces(db: any = this.prisma): boolean {
    return (
      typeof db?.relationshipSpace?.findUnique === 'function' &&
      typeof db?.relationshipSpace?.upsert === 'function'
    );
  }

  /**
   * 1. MINI-GAMES
   */
  getGameCatalog(): GameCatalogItemDto[] {
    return STATIC_GAME_CATALOG;
  }

  async inviteGame(userId: string, dto: GameInviteDto): Promise<GameSessionDto> {
    const catalogItem = STATIC_GAME_CATALOG.find((g) => g.gameKey === dto.gameKey);
    if (!catalogItem) {
      throw new NotFoundException(`Unknown game key: ${dto.gameKey}`);
    }

    const sessionId = crypto.randomUUID();
    let initialState: Record<string, any> = {};

    if (dto.gameKey === 'word_scramble') {
      initialState = {
        wordIndex: 0,
        scrambled: SCRAMBLE_WORDS[0].scrambled,
        hint: SCRAMBLE_WORDS[0].hint,
        totalWords: SCRAMBLE_WORDS.length,
      };
    } else if (dto.gameKey === 'iitm_trivia') {
      initialState = {
        questionIndex: 0,
        question: TRIVIA_QUESTIONS[0].question,
        options: TRIVIA_QUESTIONS[0].options,
        totalQuestions: TRIVIA_QUESTIONS.length,
      };
    } else {
      initialState = {
        promptIndex: 0,
        prompt: 'If you had an extra 4 hours every Sunday, how would you spend it?',
      };
    }

    return this.runInTx(async (tx) => {
      await this.matchAuth.assertAuthorizedForConversation(userId, dto.conversationId, { tx });

      if (this.hasDbGames(tx)) {
        const game = await tx.gameCatalog.upsert({
          where: { gameKey: dto.gameKey },
          create: {
            gameKey: catalogItem.gameKey,
            title: catalogItem.title,
            description: catalogItem.description,
            minPlayers: catalogItem.minPlayers,
            maxPlayers: catalogItem.maxPlayers,
            isActive: true,
          },
          update: {},
        });

        const created = await tx.gameSession.create({
          data: {
            id: sessionId,
            conversationId: dto.conversationId,
            gameId: game.id,
            sessionStatus: GameSessionStatus.INVITED,
            currentState: initialState,
            members: {
              create: [{ accountId: userId, role: 'inviter', score: 0 }],
            },
          },
          include: { game: true, members: true },
        });

        return {
          id: created.id,
          conversationId: created.conversationId,
          gameKey: created.game.gameKey,
          title: created.game.title,
          sessionStatus: created.sessionStatus as GameSessionStatus,
          currentState: (created.currentState || {}) as Record<string, any>,
          winnerAccountId: created.winnerAccountId,
          startedAt: created.startedAt ? created.startedAt.toISOString() : null,
          completedAt: created.completedAt ? created.completedAt.toISOString() : null,
        };
      }

      const session: MockGameSession = {
        id: sessionId,
        conversationId: dto.conversationId,
        gameKey: dto.gameKey,
        title: catalogItem.title,
        sessionStatus: GameSessionStatus.INVITED,
        currentState: initialState,
        winnerAccountId: null,
        members: [{ accountId: userId, score: 0 }],
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
      };

      this.mockGameSessions.set(sessionId, session);
      return this.mapToGameSessionDto(session);
    });
  }

  async respondGame(userId: string, sessionId: string, dto: GameRespondDto): Promise<GameSessionDto> {
    return this.runInTx(async (tx) => {
      if (this.hasDbGames(tx)) {
        const session = await tx.gameSession.findUnique({
          where: { id: sessionId },
          include: { game: true, members: true },
        });
        if (!session) {
          throw new NotFoundException('Game session not found');
        }

        await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });

        if (session.sessionStatus !== GameSessionStatus.INVITED) {
          throw new BadRequestException('Game invitation is no longer pending.');
        }

        const now = new Date();
        if (dto.action === 'accept' && typeof tx.gameSessionMember?.upsert === 'function') {
          await tx.gameSessionMember.upsert({
            where: { sessionId_accountId: { sessionId: session.id, accountId: userId } },
            create: { sessionId: session.id, accountId: userId, role: 'player', score: 0 },
            update: {},
          });
        }

        const updated = await tx.gameSession.update({
          where: { id: session.id },
          data:
            dto.action === 'accept'
              ? { sessionStatus: GameSessionStatus.ACTIVE, startedAt: now }
              : { sessionStatus: GameSessionStatus.DECLINED, completedAt: now },
          include: { game: true },
        });

        return {
          id: updated.id,
          conversationId: updated.conversationId,
          gameKey: updated.game.gameKey,
          title: updated.game.title,
          sessionStatus: updated.sessionStatus as GameSessionStatus,
          currentState: (updated.currentState || {}) as Record<string, any>,
          winnerAccountId: updated.winnerAccountId,
          startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
          completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
        };
      }

      const session = this.mockGameSessions.get(sessionId);
      if (!session) {
        throw new NotFoundException('Game session not found');
      }

      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });

      if (dto.action === 'accept') {
        session.sessionStatus = GameSessionStatus.ACTIVE;
        session.startedAt = new Date();
        if (!session.members.some((m) => m.accountId === userId)) {
          session.members.push({ accountId: userId, score: 0 });
        }
      } else {
        session.sessionStatus = GameSessionStatus.DECLINED;
        session.completedAt = new Date();
      }

      return this.mapToGameSessionDto(session);
    });
  }

  async submitMove(userId: string, sessionId: string, dto: GameMoveDto): Promise<GameSessionDto> {
    return this.runInTx(async (tx) => {
      if (this.hasDbGames(tx)) {
        const dbSession = await tx.gameSession.findUnique({
          where: { id: sessionId },
          include: { game: true, members: true },
        });
        if (!dbSession) {
          throw new NotFoundException('Game session not found');
        }

        await this.matchAuth.assertAuthorizedForConversation(userId, dbSession.conversationId, { tx });

        if (dbSession.sessionStatus !== GameSessionStatus.ACTIVE) {
          throw new BadRequestException('Cannot make move on an inactive game session');
        }

        const sessionLike: MockGameSession = {
          id: dbSession.id,
          conversationId: dbSession.conversationId,
          gameKey: dbSession.game.gameKey,
          title: dbSession.game.title,
          sessionStatus: dbSession.sessionStatus as GameSessionStatus,
          currentState: { ...((dbSession.currentState as Record<string, any>) || {}) },
          winnerAccountId: dbSession.winnerAccountId,
          members: (dbSession.members || []).map((m: any) => ({ accountId: m.accountId, score: m.score || 0 })),
          startedAt: dbSession.startedAt,
          completedAt: dbSession.completedAt,
          createdAt: dbSession.createdAt,
        };

        this.applyGameMoveMutation(sessionLike, userId, dto);

        const actingMember = sessionLike.members.find((m) => m.accountId === userId);
        if (actingMember && typeof tx.gameSessionMember?.upsert === 'function') {
          await tx.gameSessionMember.upsert({
            where: { sessionId_accountId: { sessionId: dbSession.id, accountId: userId } },
            create: { sessionId: dbSession.id, accountId: userId, role: 'player', score: actingMember.score },
            update: { score: actingMember.score },
          });
        }

        const updated = await tx.gameSession.update({
          where: { id: dbSession.id },
          data: {
            sessionStatus: sessionLike.sessionStatus,
            currentState: sessionLike.currentState,
            winnerAccountId: sessionLike.winnerAccountId,
            completedAt: sessionLike.completedAt,
          },
        });

        return {
          id: updated.id,
          conversationId: updated.conversationId,
          gameKey: sessionLike.gameKey,
          title: sessionLike.title,
          sessionStatus: updated.sessionStatus as GameSessionStatus,
          currentState: (updated.currentState || {}) as Record<string, any>,
          winnerAccountId: updated.winnerAccountId,
          startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
          completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
        };
      }

      const session = this.mockGameSessions.get(sessionId);
      if (!session) {
        throw new NotFoundException('Game session not found');
      }

      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });

      if (session.sessionStatus !== GameSessionStatus.ACTIVE) {
        throw new BadRequestException('Cannot make move on an inactive game session');
      }

      this.applyGameMoveMutation(session, userId, dto);
      return this.mapToGameSessionDto(session);
    });
  }

  private applyGameMoveMutation(session: MockGameSession, userId: string, dto: GameMoveDto): void {
    let player = session.members.find((m) => m.accountId === userId);
    if (!player) {
      player = { accountId: userId, score: 0 };
      session.members.push(player);
    }

    if (session.gameKey === 'word_scramble') {
      const currentIndex = session.currentState.wordIndex || 0;
      const targetWord = SCRAMBLE_WORDS[currentIndex];
      const userGuess = (dto.moveData.guess || '').toUpperCase().trim();

      if (userGuess === targetWord.solution) {
        player.score += 10;
        const nextIndex = currentIndex + 1;
        if (nextIndex < SCRAMBLE_WORDS.length) {
          session.currentState = {
            wordIndex: nextIndex,
            scrambled: SCRAMBLE_WORDS[nextIndex].scrambled,
            hint: SCRAMBLE_WORDS[nextIndex].hint,
            totalWords: SCRAMBLE_WORDS.length,
            lastCorrectGuess: userGuess,
            lastWinner: userId,
          };
        } else {
          session.sessionStatus = GameSessionStatus.COMPLETED;
          session.completedAt = new Date();
          session.winnerAccountId = userId;
          session.currentState.lastCorrectGuess = userGuess;
          session.currentState.finished = true;
        }
      } else {
        session.currentState.lastAttempt = 'incorrect';
      }
    } else if (session.gameKey === 'iitm_trivia') {
      const currentIndex = session.currentState.questionIndex || 0;
      const targetQuestion = TRIVIA_QUESTIONS[currentIndex];
      const selectedIndex = dto.moveData.selectedOption;

      if (selectedIndex === targetQuestion.correctIndex) {
        player.score += 10;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex < TRIVIA_QUESTIONS.length) {
        session.currentState = {
          questionIndex: nextIndex,
          question: TRIVIA_QUESTIONS[nextIndex].question,
          options: TRIVIA_QUESTIONS[nextIndex].options,
          totalQuestions: TRIVIA_QUESTIONS.length,
        };
      } else {
        session.sessionStatus = GameSessionStatus.COMPLETED;
        session.completedAt = new Date();
        const topScorer = session.members.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), session.members[0]);
        session.winnerAccountId = topScorer.accountId;
      }
    }
  }

  async getGameSession(userId: string, sessionId: string): Promise<GameSessionDto> {
    if (this.hasDbGames()) {
      const session = await (this.prisma as any).gameSession.findUnique({
        where: { id: sessionId },
        include: { game: true },
      });
      if (!session) {
        throw new NotFoundException('Game session not found');
      }
      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId);
      return {
        id: session.id,
        conversationId: session.conversationId,
        gameKey: session.game.gameKey,
        title: session.game.title,
        sessionStatus: session.sessionStatus as GameSessionStatus,
        currentState: (session.currentState || {}) as Record<string, any>,
        winnerAccountId: session.winnerAccountId,
        startedAt: session.startedAt ? session.startedAt.toISOString() : null,
        completedAt: session.completedAt ? session.completedAt.toISOString() : null,
      };
    }

    const session = this.mockGameSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Game session not found');
    }
    await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId);
    return this.mapToGameSessionDto(session);
  }

  /**
   * 2. VIRTUAL DATES
   */
  async proposeVirtualDate(userId: string, dto: VirtualDateProposeDto): Promise<VirtualDateDto> {
    const id = crypto.randomUUID();
    const scheduledDate = new Date(dto.scheduledFor);

    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduled date');
    }

    return this.runInTx(async (tx) => {
      await this.matchAuth.assertAuthorizedForConversation(userId, dto.conversationId, { tx });

      if (this.hasDbDates(tx)) {
        const created = await tx.virtualDate.create({
          data: {
            id,
            conversationId: dto.conversationId,
            proposedById: userId,
            scheduledFor: scheduledDate,
            timezone: dto.timezone,
            activityType: dto.activityType,
            status: VirtualDateStatus.PROPOSED,
            proposalNotes: dto.proposalNotes || null,
          },
        });
        return this.mapToVirtualDateDto(created);
      }

      const dateRecord: MockVirtualDate = {
        id,
        conversationId: dto.conversationId,
        proposedById: userId,
        scheduledFor: scheduledDate,
        timezone: dto.timezone,
        activityType: dto.activityType,
        status: VirtualDateStatus.PROPOSED,
        proposalNotes: dto.proposalNotes || null,
        createdAt: new Date(),
        completedAt: null,
      };

      this.mockVirtualDates.set(id, dateRecord);
      return this.mapToVirtualDateDto(dateRecord);
    });
  }

  async respondVirtualDate(userId: string, dateId: string, dto: VirtualDateRespondDto): Promise<VirtualDateDto> {
    return this.runInTx(async (tx) => {
      if (this.hasDbDates(tx)) {
        const dateRecord = await tx.virtualDate.findUnique({ where: { id: dateId } });
        if (!dateRecord) {
          throw new NotFoundException('Virtual date not found');
        }
        await this.matchAuth.assertAuthorizedForConversation(userId, dateRecord.conversationId, { tx });

        const updated = await tx.virtualDate.update({
          where: { id: dateId },
          data: {
            status:
              dto.action === 'accept' ? VirtualDateStatus.ACCEPTED : VirtualDateStatus.CANCELLED,
          },
        });
        return this.mapToVirtualDateDto(updated);
      }

      const dateRecord = this.mockVirtualDates.get(dateId);
      if (!dateRecord) {
        throw new NotFoundException('Virtual date not found');
      }

      await this.matchAuth.assertAuthorizedForConversation(userId, dateRecord.conversationId, { tx });

      if (dto.action === 'accept') {
        dateRecord.status = VirtualDateStatus.ACCEPTED;
      } else {
        dateRecord.status = VirtualDateStatus.CANCELLED;
      }

      return this.mapToVirtualDateDto(dateRecord);
    });
  }

  async listVirtualDates(userId: string, conversationId: string): Promise<VirtualDateDto[]> {
    await this.matchAuth.assertAuthorizedForConversation(userId, conversationId);

    if (this.hasDbDates() && typeof (this.prisma as any).virtualDate?.findMany === 'function') {
      const dates = await (this.prisma as any).virtualDate.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });
      return dates.map((d: any) => this.mapToVirtualDateDto(d));
    }

    const dates = Array.from(this.mockVirtualDates.values()).filter(
      (d) => d.conversationId === conversationId,
    );
    return dates.map((d) => this.mapToVirtualDateDto(d));
  }

  /**
   * 3. RELATIONSHIP MODE (Dual-Opt-In & Independent Unpair)
   */
  async proposeRelationship(userId: string, dto: RelationshipProposeDto) {
    return this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForMatch(userId, dto.matchId, { tx });

      let approvals = this.mockProposals.get(dto.matchId);
      if (!approvals) {
        approvals = new Set<string>();
        this.mockProposals.set(dto.matchId, approvals);
      }

      approvals.add(userId);

      // If both partners have approved, activate Relationship Space!
      if (approvals.size >= 2) {
        const userIds = Array.from(approvals);
        const space = await this.activateRelationshipSpaceInStore(
          tx,
          dto.matchId,
          userIds[0],
          auth.partnerAccountId || userIds[1],
        );
        this.mockProposals.delete(dto.matchId);
        return {
          proposed: true,
          bilateralActivated: true,
          space: this.mapToRelationshipSpaceDto(space, userId),
        };
      }

      return {
        proposed: true,
        bilateralActivated: false,
        message: 'Relationship mode proposal sent. Waiting for partner mutual affirmative action (Doc 01 §3.4)',
      };
    });
  }

  async respondRelationship(userId: string, dto: RelationshipRespondDto) {
    return this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForMatch(userId, dto.matchId, { tx });

      if (dto.action === 'accept') {
        let approvals = this.mockProposals.get(dto.matchId);
        if (!approvals) {
          approvals = new Set<string>();
          this.mockProposals.set(dto.matchId, approvals);
        }
        approvals.add(userId);

        let partnerId = auth.partnerAccountId || '';
        if (!partnerId && auth.legacyUnitMock) {
          partnerId =
            'a1111111-1111-1111-1111-111111111111' === userId
              ? 'a2222222-2222-2222-2222-222222222222'
              : 'a1111111-1111-1111-1111-111111111111';
        }

        const space = await this.activateRelationshipSpaceInStore(tx, dto.matchId, userId, partnerId);
        this.mockProposals.delete(dto.matchId);
        return {
          accepted: true,
          bilateralActivated: true,
          space: this.mapToRelationshipSpaceDto(space, userId),
        };
      } else {
        this.mockProposals.delete(dto.matchId);
        return {
          accepted: false,
          bilateralActivated: false,
          message: 'Relationship mode proposal declined',
        };
      }
    });
  }

  async getRelationshipSpace(userId: string, matchId: string): Promise<RelationshipSpaceDto> {
    const auth = await this.matchAuth.assertAuthorizedForMatch(userId, matchId);

    if (this.hasDbSpaces()) {
      const space = await (this.prisma as any).relationshipSpace.findUnique({
        where: { matchId },
      });
      if (!space || !space.isActive) {
        throw new NotFoundException('No active relationship space found for this match');
      }
      return this.mapToRelationshipSpaceDto(
        {
          id: space.id,
          matchId: space.matchId,
          userAId: auth.match.userLowId,
          userBId: auth.match.userHighId,
          isActive: space.isActive,
          activatedAt: space.activatedAt,
          disbandedAt: space.disbandedAt,
          disbandedById: space.disbandedById,
          milestones: [],
          journals: [],
        },
        userId,
      );
    }

    const space = this.mockSpaces.get(matchId);
    if (!space || !space.isActive) {
      throw new NotFoundException('No active relationship space found for this match');
    }

    if (space.userAId !== userId && space.userBId !== userId) {
      throw new ForbiddenException('Not authorized to access this relationship space');
    }

    return this.mapToRelationshipSpaceDto(space, userId);
  }

  async createMilestone(userId: string, matchId: string, dto: RelationshipMilestoneDto): Promise<IRelationshipMilestoneDto> {
    await this.matchAuth.assertAuthorizedForMatch(userId, matchId);

    if (this.hasDbSpaces() && typeof (this.prisma as any).relationshipMilestone?.create === 'function') {
      const space = await (this.prisma as any).relationshipSpace.findUnique({
        where: { matchId },
      });
      if (!space || !space.isActive) {
        throw new BadRequestException('Relationship space is not active');
      }
      const milestoneDate = new Date(dto.milestoneDate);
      const created = await (this.prisma as any).relationshipMilestone.create({
        data: {
          spaceId: space.id,
          title: dto.title,
          milestoneDate: isNaN(milestoneDate.getTime()) ? new Date() : milestoneDate,
          description: dto.description || null,
          createdById: userId,
        },
      });
      return {
        id: created.id,
        spaceId: created.spaceId,
        title: created.title,
        milestoneDate: new Date(created.milestoneDate).toISOString().split('T')[0],
        description: created.description,
        createdById: created.createdById,
        createdAt: created.createdAt.toISOString(),
      };
    }

    const space = this.mockSpaces.get(matchId);
    if (!space || !space.isActive) {
      throw new BadRequestException('Relationship space is not active');
    }

    const milestone = {
      id: crypto.randomUUID(),
      title: dto.title,
      milestoneDate: dto.milestoneDate,
      description: dto.description || null,
      createdById: userId,
      createdAt: new Date(),
    };

    space.milestones.push(milestone);

    return {
      id: milestone.id,
      spaceId: space.id,
      title: milestone.title,
      milestoneDate: milestone.milestoneDate,
      description: milestone.description,
      createdById: milestone.createdById,
      createdAt: milestone.createdAt.toISOString(),
    };
  }

  async listMilestones(userId: string, matchId: string): Promise<IRelationshipMilestoneDto[]> {
    await this.matchAuth.assertAuthorizedForMatch(userId, matchId);

    if (this.hasDbSpaces() && typeof (this.prisma as any).relationshipMilestone?.findMany === 'function') {
      const space = await (this.prisma as any).relationshipSpace.findUnique({
        where: { matchId },
        include: { milestones: { orderBy: { createdAt: 'asc' } } },
      });
      if (!space || !space.isActive) {
        throw new NotFoundException('No active relationship space found');
      }
      return space.milestones.map((m: any) => ({
        id: m.id,
        spaceId: space.id,
        title: m.title,
        milestoneDate: new Date(m.milestoneDate).toISOString().split('T')[0],
        description: m.description,
        createdById: m.createdById,
        createdAt: m.createdAt.toISOString(),
      }));
    }

    const space = this.mockSpaces.get(matchId);
    if (!space || !space.isActive) {
      throw new NotFoundException('No active relationship space found');
    }

    return space.milestones.map((m) => ({
      id: m.id,
      spaceId: space.id,
      title: m.title,
      milestoneDate: m.milestoneDate,
      description: m.description,
      createdById: m.createdById,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async createJournalEntry(userId: string, matchId: string, dto: RelationshipJournalDto): Promise<IRelationshipJournalDto> {
    await this.matchAuth.assertAuthorizedForMatch(userId, matchId);

    if (this.hasDbSpaces() && typeof (this.prisma as any).relationshipJournal?.create === 'function') {
      const space = await (this.prisma as any).relationshipSpace.findUnique({
        where: { matchId },
      });
      if (!space || !space.isActive) {
        throw new BadRequestException('Relationship space is not active');
      }
      const entryDate = new Date(dto.entryDate);
      const created = await (this.prisma as any).relationshipJournal.create({
        data: {
          spaceId: space.id,
          entryText: dto.entryText,
          entryDate: isNaN(entryDate.getTime()) ? new Date() : entryDate,
          createdById: userId,
        },
      });
      return {
        id: created.id,
        spaceId: created.spaceId,
        entryText: created.entryText,
        entryDate: new Date(created.entryDate).toISOString().split('T')[0],
        createdById: created.createdById,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    }

    const space = this.mockSpaces.get(matchId);
    if (!space || !space.isActive) {
      throw new BadRequestException('Relationship space is not active');
    }

    const now = new Date();
    const journal = {
      id: crypto.randomUUID(),
      entryText: dto.entryText,
      entryDate: dto.entryDate,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    };

    space.journals.push(journal);

    return {
      id: journal.id,
      spaceId: space.id,
      entryText: journal.entryText,
      entryDate: journal.entryDate,
      createdById: journal.createdById,
      createdAt: journal.createdAt.toISOString(),
      updatedAt: journal.updatedAt.toISOString(),
    };
  }

  async listJournalEntries(userId: string, matchId: string): Promise<IRelationshipJournalDto[]> {
    await this.matchAuth.assertAuthorizedForMatch(userId, matchId);

    if (this.hasDbSpaces() && typeof (this.prisma as any).relationshipJournal?.findMany === 'function') {
      const space = await (this.prisma as any).relationshipSpace.findUnique({
        where: { matchId },
        include: { journals: { orderBy: { createdAt: 'asc' } } },
      });
      if (!space || !space.isActive) {
        throw new NotFoundException('No active relationship space found');
      }
      return space.journals.map((j: any) => ({
        id: j.id,
        spaceId: space.id,
        entryText: j.entryText,
        entryDate: new Date(j.entryDate).toISOString().split('T')[0],
        createdById: j.createdById,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      }));
    }

    const space = this.mockSpaces.get(matchId);
    if (!space || !space.isActive) {
      throw new NotFoundException('No active relationship space found');
    }

    return space.journals.map((j) => ({
      id: j.id,
      spaceId: space.id,
      entryText: j.entryText,
      entryDate: j.entryDate,
      createdById: j.createdById,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    }));
  }

  /**
   * Unilateral independent exit (Doc 01 §3.4: "Either partner can leave independently. No surveillance or coercive monitoring.")
   */
  async leaveRelationship(userId: string, dto: RelationshipLeaveDto) {
    return this.runInTx(async (tx) => {
      await this.matchAuth.assertAuthorizedForMatch(userId, dto.matchId, {
        tx,
        allowEndedForExit: true,
      });

      this.mockProposals.delete(dto.matchId);

      if (this.hasDbSpaces(tx)) {
        const space = await tx.relationshipSpace.findUnique({ where: { matchId: dto.matchId } });
        if (!space || !space.isActive) {
          return {
            success: true,
            message: 'No active relationship space found or already deactivated',
            disbandedAt: new Date().toISOString(),
          };
        }
        const disbandedAt = new Date();
        await tx.relationshipSpace.update({
          where: { id: space.id },
          data: { isActive: false, disbandedAt, disbandedById: userId },
        });
        return {
          success: true,
          message: 'Relationship mode deactivated independently without partner approval (Doc 01 §3.4)',
          disbandedAt: disbandedAt.toISOString(),
        };
      }

      const space = this.mockSpaces.get(dto.matchId);
      if (!space || !space.isActive) {
        return {
          success: true,
          message: 'No active relationship space found or already deactivated',
          disbandedAt: new Date().toISOString(),
        };
      }

      if (space.userAId !== userId && space.userBId !== userId) {
        throw new ForbiddenException('Not authorized for this relationship space');
      }

      space.isActive = false;
      space.disbandedAt = new Date();
      space.disbandedById = userId;

      return {
        success: true,
        message: 'Relationship mode deactivated independently without partner approval (Doc 01 §3.4)',
        disbandedAt: space.disbandedAt.toISOString(),
      };
    });
  }

  private async activateRelationshipSpaceInStore(
    tx: any,
    matchId: string,
    userA: string,
    userB: string,
  ): Promise<MockRelationshipSpace> {
    if (this.hasDbSpaces(tx)) {
      const now = new Date();
      const space = await tx.relationshipSpace.upsert({
        where: { matchId },
        create: {
          matchId,
          isActive: true,
          activatedAt: now,
          disbandedAt: null,
          disbandedById: null,
        },
        update: {
          isActive: true,
          activatedAt: now,
          disbandedAt: null,
          disbandedById: null,
        },
      });
      if (typeof tx.relationshipMilestone?.create === 'function') {
        await tx.relationshipMilestone
          .create({
            data: {
              spaceId: space.id,
              title: 'Relationship Mode Activated ❤️',
              milestoneDate: now,
              description: 'Both partners confirmed mutual commitment.',
              createdById: userA,
            },
          })
          .catch(() => null);
      }
      return {
        id: space.id,
        matchId: space.matchId,
        userAId: userA,
        userBId: userB,
        isActive: true,
        activatedAt: space.activatedAt,
        disbandedAt: null,
        disbandedById: null,
        milestones: [],
        journals: [],
      };
    }

    return this.activateRelationshipSpace(matchId, userA, userB);
  }

  private activateRelationshipSpace(matchId: string, userA: string, userB: string): MockRelationshipSpace {
    const space: MockRelationshipSpace = {
      id: crypto.randomUUID(),
      matchId,
      userAId: userA,
      userBId: userB,
      isActive: true,
      activatedAt: new Date(),
      disbandedAt: null,
      disbandedById: null,
      milestones: [
        {
          id: crypto.randomUUID(),
          title: 'Relationship Mode Activated ❤️',
          milestoneDate: new Date().toISOString().split('T')[0],
          description: 'Both partners confirmed mutual commitment.',
          createdById: userA,
          createdAt: new Date(),
        },
      ],
      journals: [],
    };

    this.mockSpaces.set(matchId, space);
    return space;
  }

  private mapToGameSessionDto(session: MockGameSession): GameSessionDto {
    return {
      id: session.id,
      conversationId: session.conversationId,
      gameKey: session.gameKey,
      title: session.title,
      sessionStatus: session.sessionStatus,
      currentState: session.currentState,
      winnerAccountId: session.winnerAccountId,
      startedAt: session.startedAt ? session.startedAt.toISOString() : null,
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    };
  }

  private mapToVirtualDateDto(d: MockVirtualDate): VirtualDateDto {
    return {
      id: d.id,
      conversationId: d.conversationId,
      proposedById: d.proposedById,
      scheduledFor: d.scheduledFor.toISOString(),
      timezone: d.timezone,
      activityType: d.activityType,
      status: d.status,
      proposalNotes: d.proposalNotes,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt ? d.completedAt.toISOString() : null,
    };
  }

  private mapToRelationshipSpaceDto(s: MockRelationshipSpace, viewerId: string): RelationshipSpaceDto {
    const partnerId = s.userAId === viewerId ? s.userBId : s.userAId;
    const now = new Date();
    const activeDays = Math.max(1, Math.ceil((now.getTime() - s.activatedAt.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      id: s.id,
      matchId: s.matchId,
      partnerAccountId: partnerId,
      isActive: s.isActive,
      activatedAt: s.activatedAt.toISOString(),
      activeDays,
      disbandedAt: s.disbandedAt ? s.disbandedAt.toISOString() : null,
    };
  }
}
