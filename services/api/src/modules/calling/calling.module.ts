import { Module } from '@nestjs/common';
import { CallingController } from './calling.controller';
import { CallingService } from './calling.service';
import { LiveKitProviderAdapter } from './livekit-provider.adapter';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CallingController],
  providers: [CallingService, LiveKitProviderAdapter],
  exports: [CallingService, LiveKitProviderAdapter],
})
export class CallingModule {}
