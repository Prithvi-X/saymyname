import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import { RealtimeEventBusService } from '../realtime/realtime-event-bus.service';
import {
  GameSessionStatus,
  VirtualDateStatus,
  GameCatalogItemDto,
  GameSessionDto,
  VirtualDateDto,
  RelationshipSpaceDto,
  RelationshipStatusDto,
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
  members: Array<{ accountId: string; role?: string; score: number }>;
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
  proposalStatus: 'none' | 'proposed' | 'active' | 'declined' | 'disbanded';
  proposedById?: string | null;
  proposedAt?: Date | null;
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

const TWENTY_QUESTIONS_PROMPTS = [
  'If you had an extra 4 hours every Sunday away from screens, how would you spend them?',
  'Which course or concept in your IITM BS degree completely surprised you?',
  'What is a small ritual that instantly improves your week during term exams?',
  'If we planned a 45-minute virtual study coffee, what playlist or focus habit works best for you?',
  'What is one city, café, or library corner you want to visit after finishing this term?',
  'What makes an online conversation feel genuine and unhurried to you?',
];

@Injectable()
export class TogetherService {
  private readonly mockGameSessions: Map<string, MockGameSession> = new Map();
  private readonly mockVirtualDates: Map<string, MockVirtualDate> = new Map();
  private readonly mockProposals: Map<string, { proposedById: string; proposedAt: Date }> = new Map(); // matchId -> pending proposal (no-DB unit test fallback only)
  private readonly mockSpaces: Map<string, MockRelationshipSpace> = new Map(); // matchId -> Space
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() matchAuthService?: MatchAuthorizationService,
    @Optional() private readonly realtimeBus?: RealtimeEventBusService,
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

  private emitGameRealtimeEvent(
    conversationId: string,
    sessionId: string,
    sessionStatus: string,
    participantIds?: string[],
  ) {
    this.realtimeBus?.publishConversationEvent(
      conversationId,
      'together.game_updated',
      {
        conversationId,
        sessionId,
        sessionStatus,
        occurredAt: new Date().toISOString(),
      },
      participantIds && participantIds.length > 0
        ? { recipientAccountIds: participantIds }
        : undefined,
    );
  }

  private emitDateRealtimeEvent(
    conversationId: string,
    dateId: string,
    status: string,
    participantIds?: string[],
  ) {
    this.realtimeBus?.publishConversationEvent(
      conversationId,
      'together.date_updated',
      {
        conversationId,
        dateId,
        status,
        occurredAt: new Date().toISOString(),
      },
      participantIds && participantIds.length > 0
        ? { recipientAccountIds: participantIds }
        : undefined,
    );
  }

  private emitRelationshipRealtimeEvent(params: {
    conversationId?: string | null;
    matchId: string;
    proposalStatus: 'none' | 'proposed' | 'active' | 'declined' | 'disbanded';
    isActive: boolean;
    participantIds?: string[];
  }) {
    if (!params.conversationId) return;
    this.realtimeBus?.publishConversationEvent(
      params.conversationId,
      'together.relationship_updated',
      {
        conversationId: params.conversationId,
        matchId: params.matchId,
        proposalStatus: params.proposalStatus,
        isActive: params.isActive,
        occurredAt: new Date().toISOString(),
      },
      params.participantIds && params.participantIds.length > 0
        ? { recipientAccountIds: params.participantIds }
        : undefined,
    );
  }

  async listGameSessions(userId: string, conversationId: string): Promise<GameSessionDto[]> {
    await this.matchAuth.assertAuthorizedForConversation(userId, conversationId);

    if (this.hasDbGames() && typeof (this.prisma as any).gameSession?.findMany === 'function') {
      const rows = await (this.prisma as any).gameSession.findMany({
        where: { conversationId },
        include: { game: true, members: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return (rows || []).map((row: any) => this.mapDbGameSessionToDto(row));
    }

    return Array.from(this.mockGameSessions.values())
      .filter((s) => s.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((s) => this.mapToGameSessionDto(s));
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
        prompt: TWENTY_QUESTIONS_PROMPTS[0],
        totalPrompts: TWENTY_QUESTIONS_PROMPTS.length,
        responses: [],
      };
    }

    let participantIds: string[] = [];
    const result = await this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForConversation(userId, dto.conversationId, { tx });
      participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

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

        return this.mapDbGameSessionToDto(created);
      }

      const session: MockGameSession = {
        id: sessionId,
        conversationId: dto.conversationId,
        gameKey: dto.gameKey,
        title: catalogItem.title,
        sessionStatus: GameSessionStatus.INVITED,
        currentState: initialState,
        winnerAccountId: null,
        members: [{ accountId: userId, role: 'inviter', score: 0 }],
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
      };

      this.mockGameSessions.set(sessionId, session);
      return this.mapToGameSessionDto(session);
    });

    this.emitGameRealtimeEvent(result.conversationId, result.id, result.sessionStatus, participantIds);
    return result;
  }

  async respondGame(userId: string, sessionId: string, dto: GameRespondDto): Promise<GameSessionDto> {
    let participantIds: string[] = [];
    const result = await this.runInTx(async (tx) => {
      if (this.hasDbGames(tx)) {
        const session = await tx.gameSession.findUnique({
          where: { id: sessionId },
          include: { game: true, members: true },
        });
        if (!session) {
          throw new NotFoundException('Game session not found');
        }

        const auth = await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });
        participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

        if (session.sessionStatus !== GameSessionStatus.INVITED) {
          throw new BadRequestException('Game invitation is no longer pending.');
        }

        const inviterMember = (session.members || []).find((m: any) => m.role === 'inviter');
        if (dto.action === 'accept' && inviterMember?.accountId === userId) {
          throw new ForbiddenException('Only the invited partner can accept a game invitation.');
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
          include: { game: true, members: true },
        });

        return this.mapDbGameSessionToDto(updated);
      }

      const session = this.mockGameSessions.get(sessionId);
      if (!session) {
        throw new NotFoundException('Game session not found');
      }

      const auth = await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });
      participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

      if (session.sessionStatus !== GameSessionStatus.INVITED) {
        throw new BadRequestException('Game invitation is no longer pending.');
      }

      const inviterMember = session.members.find((m) => m.role === 'inviter');
      if (dto.action === 'accept' && inviterMember?.accountId === userId) {
        throw new ForbiddenException('Only the invited partner can accept a game invitation.');
      }

      if (dto.action === 'accept') {
        session.sessionStatus = GameSessionStatus.ACTIVE;
        session.startedAt = new Date();
        if (!session.members.some((m) => m.accountId === userId)) {
          session.members.push({ accountId: userId, role: 'player', score: 0 });
        }
      } else {
        session.sessionStatus = GameSessionStatus.DECLINED;
        session.completedAt = new Date();
      }

      return this.mapToGameSessionDto(session);
    });

    this.emitGameRealtimeEvent(result.conversationId, result.id, result.sessionStatus, participantIds);
    return result;
  }

  async endGameSession(userId: string, sessionId: string): Promise<GameSessionDto> {
    let participantIds: string[] = [];
    const result = await this.runInTx(async (tx) => {
      if (this.hasDbGames(tx)) {
        const session = await tx.gameSession.findUnique({
          where: { id: sessionId },
          include: { game: true, members: true },
        });
        if (!session) {
          throw new NotFoundException('Game session not found');
        }
        const auth = await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });
        participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

        if (
          session.sessionStatus === GameSessionStatus.COMPLETED ||
          session.sessionStatus === GameSessionStatus.DECLINED ||
          session.sessionStatus === GameSessionStatus.ABANDONED
        ) {
          return this.mapDbGameSessionToDto(session);
        }

        const updated = await tx.gameSession.update({
          where: { id: session.id },
          data: {
            sessionStatus: GameSessionStatus.ABANDONED,
            completedAt: new Date(),
          },
          include: { game: true, members: true },
        });
        return this.mapDbGameSessionToDto(updated);
      }

      const session = this.mockGameSessions.get(sessionId);
      if (!session) {
        throw new NotFoundException('Game session not found');
      }
      const auth = await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });
      participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

      if (
        session.sessionStatus === GameSessionStatus.INVITED ||
        session.sessionStatus === GameSessionStatus.ACTIVE
      ) {
        session.sessionStatus = GameSessionStatus.ABANDONED;
        session.completedAt = new Date();
      }
      return this.mapToGameSessionDto(session);
    });

    this.emitGameRealtimeEvent(result.conversationId, result.id, result.sessionStatus, participantIds);
    return result;
  }

  async submitMove(userId: string, sessionId: string, dto: GameMoveDto): Promise<GameSessionDto> {
    let participantIds: string[] = [];
    const result = await this.runInTx(async (tx) => {
      if (this.hasDbGames(tx)) {
        const dbSession = await tx.gameSession.findUnique({
          where: { id: sessionId },
          include: { game: true, members: true },
        });
        if (!dbSession) {
          throw new NotFoundException('Game session not found');
        }

        const auth = await this.matchAuth.assertAuthorizedForConversation(userId, dbSession.conversationId, { tx });
        participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

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
          members: (dbSession.members || []).map((m: any) => ({
            accountId: m.accountId,
            role: m.role,
            score: m.score || 0,
          })),
          startedAt: dbSession.startedAt,
          completedAt: dbSession.completedAt,
          createdAt: dbSession.createdAt,
        };

        this.applyGameMoveMutation(sessionLike, userId, dto);

        for (const m of sessionLike.members) {
          if (typeof tx.gameSessionMember?.upsert === 'function') {
            await tx.gameSessionMember.upsert({
              where: { sessionId_accountId: { sessionId: dbSession.id, accountId: m.accountId } },
              create: {
                sessionId: dbSession.id,
                accountId: m.accountId,
                role: m.role || 'player',
                score: m.score,
              },
              update: { score: m.score },
            });
          }
        }

        const updated = await tx.gameSession.update({
          where: { id: dbSession.id },
          data: {
            sessionStatus: sessionLike.sessionStatus,
            currentState: sessionLike.currentState,
            winnerAccountId: sessionLike.winnerAccountId,
            completedAt: sessionLike.completedAt,
          },
          include: { game: true, members: true },
        });

        return this.mapDbGameSessionToDto(updated);
      }

      const session = this.mockGameSessions.get(sessionId);
      if (!session) {
        throw new NotFoundException('Game session not found');
      }

      const auth = await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });
      participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

      if (session.sessionStatus !== GameSessionStatus.ACTIVE) {
        throw new BadRequestException('Cannot make move on an inactive game session');
      }

      this.applyGameMoveMutation(session, userId, dto);
      return this.mapToGameSessionDto(session);
    });

    this.emitGameRealtimeEvent(result.conversationId, result.id, result.sessionStatus, participantIds);
    return result;
  }

  private applyGameMoveMutation(session: MockGameSession, userId: string, dto: GameMoveDto): void {
    let player = session.members.find((m) => m.accountId === userId);
    if (!player) {
      player = { accountId: userId, role: 'player', score: 0 };
      session.members.push(player);
    }

    if (session.gameKey === 'word_scramble') {
      const currentIndex = session.currentState.wordIndex || 0;
      const targetWord = SCRAMBLE_WORDS[currentIndex];
      const userGuess = String(dto.moveData?.guess || '').toUpperCase().trim();
      if (!userGuess) {
        throw new BadRequestException('Enter a word guess before submitting.');
      }

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
          const topScorer = session.members.reduce(
            (prev, curr) => (curr.score > prev.score ? curr : prev),
            session.members[0],
          );
          session.winnerAccountId = topScorer?.accountId || userId;
          session.currentState = {
            ...session.currentState,
            lastCorrectGuess: userGuess,
            lastWinner: userId,
            finished: true,
          };
        }
      } else {
        session.currentState = {
          ...session.currentState,
          lastAttempt: 'incorrect',
          lastAttemptBy: userId,
        };
      }
    } else if (session.gameKey === 'iitm_trivia') {
      const currentIndex = session.currentState.questionIndex || 0;
      const targetQuestion = TRIVIA_QUESTIONS[currentIndex];
      const selectedIndex = Number(dto.moveData?.selectedOption);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= targetQuestion.options.length) {
        throw new BadRequestException('Select a valid trivia option.');
      }

      const wasCorrect = selectedIndex === targetQuestion.correctIndex;
      if (wasCorrect) {
        player.score += 10;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex < TRIVIA_QUESTIONS.length) {
        session.currentState = {
          questionIndex: nextIndex,
          question: TRIVIA_QUESTIONS[nextIndex].question,
          options: TRIVIA_QUESTIONS[nextIndex].options,
          totalQuestions: TRIVIA_QUESTIONS.length,
          lastQuestionCorrect: wasCorrect,
          lastAnsweredBy: userId,
        };
      } else {
        session.sessionStatus = GameSessionStatus.COMPLETED;
        session.completedAt = new Date();
        const topScorer = session.members.reduce(
          (prev, curr) => (curr.score > prev.score ? curr : prev),
          session.members[0],
        );
        session.winnerAccountId = topScorer.accountId;
        session.currentState = {
          ...session.currentState,
          lastQuestionCorrect: wasCorrect,
          lastAnsweredBy: userId,
          finished: true,
        };
      }
    } else if (session.gameKey === 'twenty_questions') {
      const currentIndex = session.currentState.promptIndex || 0;
      const answerText = String(dto.moveData?.answer || '').trim();
      if (!answerText || answerText.length > 240) {
        throw new BadRequestException('Share a thoughtful answer between 1 and 240 characters.');
      }

      const existingResponses: Array<{ accountId: string; answer: string }> = Array.isArray(
        session.currentState.responses,
      )
        ? [...session.currentState.responses]
        : [];
      const idx = existingResponses.findIndex((r) => r.accountId === userId);
      if (idx >= 0) {
        existingResponses[idx] = { accountId: userId, answer: answerText };
      } else {
        existingResponses.push({ accountId: userId, answer: answerText });
      }

      if (existingResponses.length >= 2) {
        for (const m of session.members) {
          m.score += 10;
        }
        const nextIndex = currentIndex + 1;
        if (nextIndex < TWENTY_QUESTIONS_PROMPTS.length) {
          session.currentState = {
            promptIndex: nextIndex,
            prompt: TWENTY_QUESTIONS_PROMPTS[nextIndex],
            totalPrompts: TWENTY_QUESTIONS_PROMPTS.length,
            responses: [],
            lastCompletedPrompt: TWENTY_QUESTIONS_PROMPTS[currentIndex],
            lastCompletedResponses: existingResponses,
          };
        } else {
          session.sessionStatus = GameSessionStatus.COMPLETED;
          session.completedAt = new Date();
          session.currentState = {
            ...session.currentState,
            responses: existingResponses,
            finished: true,
          };
        }
      } else {
        session.currentState = {
          ...session.currentState,
          promptIndex: currentIndex,
          prompt: TWENTY_QUESTIONS_PROMPTS[currentIndex] || session.currentState.prompt,
          totalPrompts: TWENTY_QUESTIONS_PROMPTS.length,
          responses: existingResponses,
        };
      }
    }
  }

  async getGameSession(userId: string, sessionId: string): Promise<GameSessionDto> {
    if (this.hasDbGames()) {
      const session = await (this.prisma as any).gameSession.findUnique({
        where: { id: sessionId },
        include: { game: true, members: true },
      });
      if (!session) {
        throw new NotFoundException('Game session not found');
      }
      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId);
      return this.mapDbGameSessionToDto(session);
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
    if (scheduledDate.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BadRequestException('Virtual date time must be in the future.');
    }

    let participantIds: string[] = [];
    const result = await this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForConversation(userId, dto.conversationId, { tx });
      participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

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
            proposalNotes: dto.proposalNotes?.trim() || null,
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
        proposalNotes: dto.proposalNotes?.trim() || null,
        createdAt: new Date(),
        completedAt: null,
      };

      this.mockVirtualDates.set(id, dateRecord);
      return this.mapToVirtualDateDto(dateRecord);
    });

    this.emitDateRealtimeEvent(result.conversationId, result.id, result.status, participantIds);
    return result;
  }

  async respondVirtualDate(userId: string, dateId: string, dto: VirtualDateRespondDto): Promise<VirtualDateDto> {
    let participantIds: string[] = [];
    const result = await this.runInTx(async (tx) => {
      if (this.hasDbDates(tx)) {
        const dateRecord = await tx.virtualDate.findUnique({ where: { id: dateId } });
        if (!dateRecord) {
          throw new NotFoundException('Virtual date not found');
        }
        const auth = await this.matchAuth.assertAuthorizedForConversation(userId, dateRecord.conversationId, { tx });
        participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

        if (dto.action === 'accept') {
          if (dateRecord.proposedById === userId) {
            throw new ForbiddenException('Only the partner receiving a virtual date proposal can accept it.');
          }
          if (dateRecord.status !== VirtualDateStatus.PROPOSED) {
            throw new BadRequestException('Virtual date proposal is no longer pending.');
          }
        }

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

      const auth = await this.matchAuth.assertAuthorizedForConversation(userId, dateRecord.conversationId, { tx });
      participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];

      if (dto.action === 'accept') {
        if (dateRecord.proposedById === userId) {
          throw new ForbiddenException('Only the partner receiving a virtual date proposal can accept it.');
        }
        if (dateRecord.status !== VirtualDateStatus.PROPOSED) {
          throw new BadRequestException('Virtual date proposal is no longer pending.');
        }
        dateRecord.status = VirtualDateStatus.ACCEPTED;
      } else {
        dateRecord.status = VirtualDateStatus.CANCELLED;
      }

      return this.mapToVirtualDateDto(dateRecord);
    });

    this.emitDateRealtimeEvent(result.conversationId, result.id, result.status, participantIds);
    return result;
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
  private async resolveMatchConversationId(tx: any, auth: any, matchId: string): Promise<string | null> {
    if (auth?.match?.conversation?.id) return auth.match.conversation.id;
    if (typeof tx?.conversation?.findUnique === 'function') {
      const conv = await tx.conversation
        .findUnique({ where: { matchId }, select: { id: true } })
        .catch(() => null);
      return conv?.id || null;
    }
    return null;
  }

  async proposeRelationship(userId: string, dto: RelationshipProposeDto) {
    let eventPayload: {
      conversationId?: string | null;
      matchId: string;
      proposalStatus: 'none' | 'proposed' | 'active' | 'declined' | 'disbanded';
      isActive: boolean;
      participantIds?: string[];
    } | null = null;

    const result = await this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForMatch(userId, dto.matchId, { tx });
      const participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];
      const conversationId = await this.resolveMatchConversationId(tx, auth, dto.matchId);
      const now = new Date();

      if (this.hasDbSpaces(tx)) {
        const existing = await tx.relationshipSpace.findUnique({ where: { matchId: dto.matchId } });
        if (existing?.isActive) {
          return {
            proposed: true,
            bilateralActivated: true,
            space: this.mapToRelationshipSpaceDto(
              {
                id: existing.id,
                matchId: existing.matchId,
                userAId: auth.match.userLowId,
                userBId: auth.match.userHighId,
                proposalStatus: 'active',
                isActive: true,
                activatedAt: existing.activatedAt,
                disbandedAt: null,
                disbandedById: null,
                milestones: [],
                journals: [],
              },
              userId,
            ),
          };
        }

        if (existing && existing.proposalStatus === 'proposed' && existing.proposedById && existing.proposedById !== userId) {
          const space = await this.activateRelationshipSpaceInStore(
            tx,
            dto.matchId,
            existing.proposedById,
            userId,
          );
          eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'active', isActive: true, participantIds };
          return {
            proposed: true,
            bilateralActivated: true,
            space: this.mapToRelationshipSpaceDto(space, userId),
          };
        }

        await tx.relationshipSpace.upsert({
          where: { matchId: dto.matchId },
          create: {
            matchId: dto.matchId,
            proposalStatus: 'proposed',
            proposedById: userId,
            proposedAt: now,
            isActive: false,
            disbandedAt: null,
            disbandedById: null,
          },
          update: {
            proposalStatus: 'proposed',
            proposedById: userId,
            proposedAt: now,
            isActive: false,
            disbandedAt: null,
            disbandedById: null,
          },
        });

        eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'proposed', isActive: false, participantIds };
        return {
          proposed: true,
          bilateralActivated: false,
          message: 'Relationship mode proposal sent. Waiting for partner mutual affirmative action (Doc 01 §3.4)',
        };
      }

      const existingMockSpace = this.mockSpaces.get(dto.matchId);
      if (existingMockSpace?.isActive) {
        return {
          proposed: true,
          bilateralActivated: true,
          space: this.mapToRelationshipSpaceDto(existingMockSpace, userId),
        };
      }

      const pendingProposal = this.mockProposals.get(dto.matchId);
      if (pendingProposal && pendingProposal.proposedById !== userId) {
        const space = await this.activateRelationshipSpaceInStore(
          tx,
          dto.matchId,
          pendingProposal.proposedById,
          userId,
        );
        this.mockProposals.delete(dto.matchId);
        eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'active', isActive: true, participantIds };
        return {
          proposed: true,
          bilateralActivated: true,
          space: this.mapToRelationshipSpaceDto(space, userId),
        };
      }

      this.mockProposals.set(dto.matchId, { proposedById: userId, proposedAt: now });
      eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'proposed', isActive: false, participantIds };
      return {
        proposed: true,
        bilateralActivated: false,
        message: 'Relationship mode proposal sent. Waiting for partner mutual affirmative action (Doc 01 §3.4)',
      };
    });

    if (eventPayload) {
      this.emitRelationshipRealtimeEvent(eventPayload);
    }
    return result;
  }

  async respondRelationship(userId: string, dto: RelationshipRespondDto) {
    let eventPayload: {
      conversationId?: string | null;
      matchId: string;
      proposalStatus: 'none' | 'proposed' | 'active' | 'declined' | 'disbanded';
      isActive: boolean;
      participantIds?: string[];
    } | null = null;

    const result = await this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForMatch(userId, dto.matchId, { tx });
      const participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];
      const conversationId = await this.resolveMatchConversationId(tx, auth, dto.matchId);
      const now = new Date();

      if (this.hasDbSpaces(tx)) {
        const existing = await tx.relationshipSpace.findUnique({ where: { matchId: dto.matchId } });
        if (!existing || existing.proposalStatus !== 'proposed' || !existing.proposedById) {
          throw new BadRequestException('No pending Relationship Mode proposal to respond to.');
        }

        if (dto.action === 'accept') {
          if (existing.proposedById === userId) {
            throw new ForbiddenException(
              'Both partners must confirm Relationship Mode independently; you cannot accept your own proposal (Doc 01 §3.4).',
            );
          }
          const space = await this.activateRelationshipSpaceInStore(
            tx,
            dto.matchId,
            existing.proposedById,
            userId,
          );
          eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'active', isActive: true, participantIds };
          return {
            accepted: true,
            bilateralActivated: true,
            space: this.mapToRelationshipSpaceDto(space, userId),
          };
        }

        await tx.relationshipSpace.update({
          where: { id: existing.id },
          data: {
            isActive: false,
            proposalStatus: 'declined',
            disbandedById: userId,
            disbandedAt: now,
          },
        });
        eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'declined', isActive: false, participantIds };
        return {
          accepted: false,
          bilateralActivated: false,
          message: 'Relationship mode proposal declined',
        };
      }

      const pendingProposal = this.mockProposals.get(dto.matchId);
      if (dto.action === 'accept') {
        if (!pendingProposal) {
          throw new BadRequestException('No pending Relationship Mode proposal to respond to.');
        }
        if (pendingProposal.proposedById === userId) {
          throw new ForbiddenException(
            'Both partners must confirm Relationship Mode independently; you cannot accept your own proposal (Doc 01 §3.4).',
          );
        }

        let partnerId = auth.partnerAccountId || pendingProposal.proposedById || '';
        if (!partnerId && auth.legacyUnitMock) {
          partnerId =
            'a1111111-1111-1111-1111-111111111111' === userId
              ? 'a2222222-2222-2222-2222-222222222222'
              : 'a1111111-1111-1111-1111-111111111111';
        }

        const space = await this.activateRelationshipSpaceInStore(tx, dto.matchId, partnerId, userId);
        this.mockProposals.delete(dto.matchId);
        eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'active', isActive: true, participantIds };
        return {
          accepted: true,
          bilateralActivated: true,
          space: this.mapToRelationshipSpaceDto(space, userId),
        };
      }

      this.mockProposals.delete(dto.matchId);
      eventPayload = { conversationId, matchId: dto.matchId, proposalStatus: 'declined', isActive: false, participantIds };
      return {
        accepted: false,
        bilateralActivated: false,
        message: 'Relationship mode proposal declined',
      };
    });

    if (eventPayload) {
      this.emitRelationshipRealtimeEvent(eventPayload);
    }
    return result;
  }

  async getRelationshipStatus(userId: string, matchId: string): Promise<RelationshipStatusDto> {
    const auth = await this.matchAuth.assertAuthorizedForMatch(userId, matchId);

    if (this.hasDbSpaces()) {
      const space = await (this.prisma as any).relationshipSpace.findUnique({
        where: { matchId },
      });
      if (!space) {
        return {
          matchId,
          proposalStatus: 'none',
          proposedById: null,
          isActive: false,
          space: null,
        };
      }
      const status = (space.proposalStatus ||
        (space.isActive ? 'active' : 'disbanded')) as RelationshipStatusDto['proposalStatus'];
      return {
        matchId,
        proposalStatus: status,
        proposedById: space.proposedById || null,
        isActive: Boolean(space.isActive),
        space: space.isActive
          ? this.mapToRelationshipSpaceDto(
              {
                id: space.id,
                matchId: space.matchId,
                userAId: auth.match.userLowId,
                userBId: auth.match.userHighId,
                proposalStatus: 'active',
                isActive: true,
                activatedAt: space.activatedAt,
                disbandedAt: space.disbandedAt,
                disbandedById: space.disbandedById,
                milestones: [],
                journals: [],
              },
              userId,
            )
          : null,
      };
    }

    const mockSpace = this.mockSpaces.get(matchId);
    if (mockSpace && mockSpace.isActive) {
      return {
        matchId,
        proposalStatus: 'active',
        proposedById: mockSpace.proposedById || null,
        isActive: true,
        space: this.mapToRelationshipSpaceDto(mockSpace, userId),
      };
    }

    const pending = this.mockProposals.get(matchId);
    if (pending) {
      return {
        matchId,
        proposalStatus: 'proposed',
        proposedById: pending.proposedById,
        isActive: false,
        space: null,
      };
    }

    if (mockSpace && !mockSpace.isActive) {
      return {
        matchId,
        proposalStatus: 'disbanded',
        proposedById: null,
        isActive: false,
        space: null,
      };
    }

    return {
      matchId,
      proposalStatus: 'none',
      proposedById: null,
      isActive: false,
      space: null,
    };
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
          proposalStatus: 'active',
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
    let eventPayload: {
      conversationId?: string | null;
      matchId: string;
      proposalStatus: 'none' | 'proposed' | 'active' | 'declined' | 'disbanded';
      isActive: boolean;
      participantIds?: string[];
    } | null = null;

    const result = await this.runInTx(async (tx) => {
      const auth = await this.matchAuth.assertAuthorizedForMatch(userId, dto.matchId, {
        tx,
        allowEndedForExit: true,
      });
      const participantIds = [userId, auth.partnerAccountId].filter(Boolean) as string[];
      const conversationId = await this.resolveMatchConversationId(tx, auth, dto.matchId);

      this.mockProposals.delete(dto.matchId);

      if (this.hasDbSpaces(tx)) {
        const space = await tx.relationshipSpace.findUnique({ where: { matchId: dto.matchId } });
        if (!space || (!space.isActive && space.proposalStatus !== 'proposed')) {
          return {
            success: true,
            message: 'No active relationship space found or already deactivated',
            disbandedAt: new Date().toISOString(),
          };
        }
        const disbandedAt = new Date();
        await tx.relationshipSpace.update({
          where: { id: space.id },
          data: {
            isActive: false,
            proposalStatus: 'disbanded',
            disbandedAt,
            disbandedById: userId,
          },
        });
        eventPayload = {
          conversationId,
          matchId: dto.matchId,
          proposalStatus: 'disbanded',
          isActive: false,
          participantIds,
        };
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
      space.proposalStatus = 'disbanded';
      space.disbandedAt = new Date();
      space.disbandedById = userId;
      eventPayload = {
        conversationId,
        matchId: dto.matchId,
        proposalStatus: 'disbanded',
        isActive: false,
        participantIds,
      };

      return {
        success: true,
        message: 'Relationship mode deactivated independently without partner approval (Doc 01 §3.4)',
        disbandedAt: space.disbandedAt.toISOString(),
      };
    });

    if (eventPayload) {
      this.emitRelationshipRealtimeEvent(eventPayload);
    }
    return result;
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
          proposalStatus: 'active',
          proposedById: userA,
          proposedAt: now,
          isActive: true,
          activatedAt: now,
          disbandedAt: null,
          disbandedById: null,
        },
        update: {
          proposalStatus: 'active',
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
        proposalStatus: 'active',
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
      proposalStatus: 'active',
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

  private mapDbGameSessionToDto(session: any): GameSessionDto {
    const members = Array.isArray(session.members)
      ? session.members.map((m: any) => ({
          accountId: m.accountId,
          role: m.role || 'player',
          score: Number(m.score ?? 0),
        }))
      : [];
    const inviter = members.find((m: any) => m.role === 'inviter');
    return {
      id: session.id,
      conversationId: session.conversationId,
      gameKey: session.game?.gameKey || '',
      title: session.game?.title || '',
      sessionStatus: session.sessionStatus as GameSessionStatus,
      currentState: (session.currentState || {}) as Record<string, any>,
      winnerAccountId: session.winnerAccountId,
      invitedByAccountId: inviter?.accountId || null,
      members,
      startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
      completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
    };
  }

  private mapToGameSessionDto(session: MockGameSession): GameSessionDto {
    const inviter = session.members.find((m) => m.role === 'inviter');
    return {
      id: session.id,
      conversationId: session.conversationId,
      gameKey: session.gameKey,
      title: session.title,
      sessionStatus: session.sessionStatus,
      currentState: session.currentState,
      winnerAccountId: session.winnerAccountId,
      invitedByAccountId: inviter?.accountId || session.members[0]?.accountId || null,
      members: session.members.map((m) => ({
        accountId: m.accountId,
        role: m.role || 'player',
        score: m.score,
      })),
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
