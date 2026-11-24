import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class EligibilityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    if (!user.discoveryEligible) {
      throw new ForbiddenException(
        'Dating capabilities require 18+ age verification and active IIT Madras student verification',
      );
    }

    return true;
  }
}
