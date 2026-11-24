import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * ReviewerGuard (D-P2-01)
 * Fail-closed guard for verification case review endpoints.
 * Requires configured REVIEWER_API_KEY (>= 16 chars) matched in constant time.
 */
@Injectable()
export class ReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredKey = process.env.REVIEWER_API_KEY || '';
    if (configuredKey.length < 16) {
      throw new ForbiddenException(
        'Reviewer authorization is not configured on this environment.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const rawHeader = request.headers['x-smn-reviewer-key'];
    const suppliedKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!suppliedKey || typeof suppliedKey !== 'string') {
      throw new ForbiddenException('Missing reviewer credential.');
    }

    const expectedBuf = Buffer.from(configuredKey, 'utf8');
    const suppliedBuf = Buffer.from(suppliedKey, 'utf8');
    if (
      expectedBuf.length !== suppliedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, suppliedBuf)
    ) {
      throw new ForbiddenException('Invalid reviewer credential.');
    }

    const principalHeader = request.headers['x-smn-reviewer-id'];
    const rawPrincipal = Array.isArray(principalHeader)
      ? principalHeader[0]
      : principalHeader;
    const sanitizedPrincipal =
      typeof rawPrincipal === 'string' && /^[a-zA-Z0-9._-]{2,64}$/.test(rawPrincipal)
        ? rawPrincipal
        : 'authorised_reviewer';

    request.reviewerPrincipalId = sanitizedPrincipal;
    return true;
  }
}
