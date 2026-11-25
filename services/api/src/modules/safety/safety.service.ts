import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchAuthorizationService } from './match-authorization.service';
import {
  ALLOWED_REPORT_CATEGORIES,
  BlockUserDto,
  ReportUserDto,
} from './dto/safety.dto';

const ALLOWED_CATEGORY_SET = new Set<string>(ALLOWED_REPORT_CATEGORIES);

@Injectable()
export class SafetyService {
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() matchAuthService?: MatchAuthorizationService,
  ) {
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private async resolveTargetAccountId(
    db: any,
    targetProfileId?: string,
    directAccountId?: string,
  ): Promise<string> {
    if (targetProfileId) {
      if (typeof db.profile?.findUnique !== 'function') {
        throw new ServiceUnavailableException('Profile resolution unavailable.');
      }
      const profile = await db.profile.findUnique({
        where: { id: targetProfileId },
        select: { accountId: true },
      });
      if (!profile) {
        throw new NotFoundException('Target profile not found.');
      }
      return profile.accountId;
    }

    if (directAccountId && directAccountId.trim().length > 0) {
      return directAccountId.trim();
    }

    throw new BadRequestException('Target identifier is required.');
  }

  /**
   * 1. Instant Bi-directional Block
   * Unmatches active pair, closes conversations, neutralizes active likes, and prevents candidate visibility.
   */
  async blockUser(blockerId: string, dto: BlockUserDto) {
    try {
      return await this.runInTx(async (tx) => {
        const targetAccountId = await this.resolveTargetAccountId(
          tx,
          dto.targetProfileId,
          dto.blockedId,
        );

        if (blockerId === targetAccountId) {
          throw new BadRequestException('You cannot block yourself.');
        }

        // 1. Persist bi-directional exclusion record
        await tx.userBlock.upsert({
          where: {
            blockerId_blockedId: { blockerId, blockedId: targetAccountId },
          },
          create: {
            blockerId,
            blockedId: targetAccountId,
            reason: dto.reason,
          },
          update: {
            reason: dto.reason,
          },
        });

        // 2. Suppress any unilateral Likes in either direction so a pair cannot auto-match later
        if (typeof tx.like?.updateMany === 'function') {
          await tx.like.updateMany({
            where: {
              OR: [
                { fromAccountId: blockerId, toAccountId: targetAccountId },
                { fromAccountId: targetAccountId, toAccountId: blockerId },
              ],
              status: 'active',
            },
            data: { status: 'blocked' },
          });
        }

        // 3. Terminate any active match and close shared conversation
        const [userLowId, userHighId] = [blockerId, targetAccountId].sort();
        const match = await tx.match.findUnique({
          where: { userLowId_userHighId: { userLowId, userHighId } },
          include: { conversation: true },
        });

        if (match) {
          await this.matchAuth.closeMatchDownstreamState(tx, {
            match,
            actorId: blockerId,
            endedByAccountId: blockerId,
            endReason: `User blocked: ${dto.reason || 'Safety action'}`,
            stateMetadata: { action: 'user_block' },
            markLikesStatus: 'blocked',
          });
        }

        return {
          success: true,
          message:
            'User blocked successfully. Active matches and conversations have been terminated.',
        };
      });
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      throw new ServiceUnavailableException(
        'Safety block service is temporarily unavailable. Please retry.',
      );
    }
  }

  /**
   * 2. Report User / Harm Case
   */
  async reportUser(reporterId: string, dto: ReportUserDto) {
    if (!ALLOWED_CATEGORY_SET.has(dto.reportCategory)) {
      throw new BadRequestException('Invalid report category.');
    }

    try {
      const targetAccountId = await this.resolveTargetAccountId(
        this.prisma,
        dto.targetProfileId,
        dto.reportedId,
      );

      if (reporterId === targetAccountId) {
        throw new BadRequestException('You cannot report your own profile.');
      }

      const report = await this.prisma.report.create({
        data: {
          reporterId,
          reportedId: targetAccountId,
          reportCategory: dto.reportCategory,
          description: dto.description?.trim() || null,
          status: 'pending',
        },
      });

      return {
        success: true,
        reportId: report.id,
        message: 'Report submitted. Our trust & safety moderation team will investigate.',
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      throw new ServiceUnavailableException(
        'Safety reporting service is temporarily unavailable. Please retry.',
      );
    }
  }
}
