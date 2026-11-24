import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { DatingModule } from './modules/dating/dating.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { SafetyModule } from './modules/safety/safety.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
    IdentityModule,
    ProfilesModule,
    DatingModule,
    MessagingModule,
    SafetyModule,
  ],
})
export class AppModule {}
