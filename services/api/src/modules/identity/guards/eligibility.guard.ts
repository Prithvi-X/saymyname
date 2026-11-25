import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EligibilityGuard implements CanActivate {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('User context not found');
    }

    // Check authoritative PostgreSQL state when PrismaService is active
    if (this.prisma && typeof this.prisma.account?.findUnique === 'function') {
      const account = await this.prisma.account
        .findUnique({
          where: { id: user.sub },
          select: {
            accountStatus: true,
            deletedAt: true,
            eligibility: {
              select: {
                ageStatus: true,
                studentStatus: true,
                discoveryEligible: true,
                dateOfBirth: true,
              },
            },
          },
        })
        .catch(() => null);

      if (account) {
        const hasVerifiedDob =
          !account.eligibility ||
          !('dateOfBirth' in account.eligibility) ||
          account.eligibility.dateOfBirth !== null;
        const ok =
          !account.deletedAt &&
          account.accountStatus === 'active' &&
          account.eligibility?.discoveryEligible === true &&
          account.eligibility?.ageStatus === 'approved' &&
          account.eligibility?.studentStatus === 'approved' &&
          hasVerifiedDob;
        if (!ok) {
          throw new ForbiddenException(
            'Dating capabilities require verified 18+ age and approved IIT Madras BS student eligibility',
          );
        }
        return true;
      }
    }

    if (!user.discoveryEligible) {
      throw new ForbiddenException(
        'Dating capabilities require 18+ age verification and active IIT Madras student verification',
      );
    }

    return true;
  }
}
