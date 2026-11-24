import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { CryptoService } from './security/crypto.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EligibilityGuard } from './guards/eligibility.guard';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, CryptoService, JwtAuthGuard, EligibilityGuard],
  exports: [IdentityService, CryptoService, JwtAuthGuard, EligibilityGuard],
})
export class IdentityModule {}
