import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'webhook-processing',
    }),
    BullModule.registerQueue({
      name: 'campaign-sender',
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}

