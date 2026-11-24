import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EligibilityGuard } from '../guards/eligibility.guard';

@Global()
@Module({
  providers: [CryptoService, JwtAuthGuard, EligibilityGuard],
  exports: [CryptoService, JwtAuthGuard, EligibilityGuard],
})
export class SecurityModule {}
