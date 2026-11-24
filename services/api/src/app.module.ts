import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { SecurityModule } from './modules/identity/security/security.module';
import { VerificationModule } from './modules/verification/verification.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { DatingModule } from './modules/dating/dating.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { SafetyModule } from './modules/safety/safety.module';
import { CallingModule } from './modules/calling/calling.module';
import { TogetherModule } from './modules/together/together.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', 'services/api/.env.local', '.env'],
    }),
    PrismaModule,
    SecurityModule,
    VerificationModule,
    HealthModule,
    IdentityModule,
    ProfilesModule,
    DatingModule,
    MessagingModule,
    SafetyModule,
    CallingModule,
    TogetherModule,
  ],
})
export class AppModule {}
