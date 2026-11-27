import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RetentionPurgeService } from './retention-purge.service';

@Module({
  imports: [PrismaModule],
  providers: [RetentionPurgeService],
  exports: [RetentionPurgeService],
})
export class RetentionModule {}
