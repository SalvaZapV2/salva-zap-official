import { Module } from '@nestjs/common';
import { WabaController } from './waba.controller';
import { WabaService } from './waba.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'webhook-processing',
    }),
  ],
  controllers: [WabaController],
  providers: [WabaService],
  exports: [WabaService],
})
export class WabaModule {}

