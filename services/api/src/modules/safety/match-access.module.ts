import { Module } from '@nestjs/common';
import { MatchAuthorizationService } from './match-authorization.service';

@Module({
  providers: [MatchAuthorizationService],
  exports: [MatchAuthorizationService],
})
export class MatchAccessModule {}
