import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ShopsModule } from './shops/shops.module';
import { WabaModule } from './waba/waba.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MessagesModule } from './messages/messages.module';
import { InboxModule } from './inbox/inbox.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const connection = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
        });
        return { connection };
      },
    }),
    PrismaModule,
    AuthModule,
    ShopsModule,
    WabaModule,
    WebhooksModule,
    MessagesModule,
    InboxModule,
    TemplatesModule,
    CampaignsModule,
    HealthModule,
    DashboardModule,
  ],
})
export class AppModule {}

