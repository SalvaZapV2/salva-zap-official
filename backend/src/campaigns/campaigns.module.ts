import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignCostService } from './campaign-cost.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { CampaignProcessor } from './campaign.processor';
import { MessagesModule } from '../messages/messages.module';
import { RateLimiterUtil } from '../common/utils/rate-limiter.util';

@Module({
  imports: [
    PrismaModule,
    MessagesModule,
    BullModule.registerQueue({
      name: 'campaign-sender',
    }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignProcessor, CampaignCostService, RateLimiterUtil],
  exports: [CampaignsService],
})
export class CampaignsModule {}

