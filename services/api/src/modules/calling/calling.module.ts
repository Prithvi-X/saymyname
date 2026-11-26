import { Module } from '@nestjs/common';
import { CallingController } from './calling.controller';
import { CallingService } from './calling.service';
import { LiveKitProviderAdapter } from './livekit-provider.adapter';
import { CallEvictionRelayService } from './call-eviction-relay.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CallingController],
  providers: [CallingService, LiveKitProviderAdapter, CallEvictionRelayService],
  exports: [CallingService, LiveKitProviderAdapter, CallEvictionRelayService],
})
export class CallingModule {}
