import { Module } from '@nestjs/common';
import { DatingService } from './dating.service';
import { DatingController } from './dating.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [DatingController],
  providers: [DatingService],
  exports: [DatingService],
})
export class DatingModule {}
