import { Module } from '@nestjs/common';
import { TogetherController } from './together.controller';
import { TogetherService } from './together.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [TogetherController],
  providers: [TogetherService],
  exports: [TogetherService],
})
export class TogetherModule {}
