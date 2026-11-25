import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { SecurityModule } from './security/security.module';
import { VerificationModule } from '../verification/verification.module';
import { MatchAccessModule } from '../safety/match-access.module';

@Module({
  imports: [SecurityModule, VerificationModule, MatchAccessModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService, SecurityModule, VerificationModule, MatchAccessModule],
})
export class IdentityModule {}
