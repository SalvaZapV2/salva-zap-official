import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { WebhookProcessor } from './webhook.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'webhook-processing',
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}

