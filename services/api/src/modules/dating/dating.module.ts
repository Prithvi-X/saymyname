import { Module } from '@nestjs/common';
import { DatingService } from './dating.service';
import { DatingController } from './dating.controller';
import { DiscoveryEligibilityService } from './discovery-eligibility.service';
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [IdentityModule, ProfilesModule],
  controllers: [DatingController],
  providers: [DatingService, DiscoveryEligibilityService],
  exports: [DatingService, DiscoveryEligibilityService],
})
export class DatingModule {}
