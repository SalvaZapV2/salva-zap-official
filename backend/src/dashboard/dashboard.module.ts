import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'webhook-processing' }),
    BullModule.registerQueue({ name: 'campaign-sender' }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

