import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { ReviewerGuard } from './reviewer.guard';
import { MatchAccessModule } from '../safety/match-access.module';

@Module({
  imports: [MatchAccessModule],
  controllers: [VerificationController],
  providers: [VerificationService, ReviewerGuard],
  exports: [VerificationService, ReviewerGuard],
})
export class VerificationModule {}
