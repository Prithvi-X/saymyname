import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { SecurityModule } from './security/security.module';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [SecurityModule, VerificationModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService, SecurityModule, VerificationModule],
})
export class IdentityModule {}
