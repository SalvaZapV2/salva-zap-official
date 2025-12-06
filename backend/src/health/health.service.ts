import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
    @InjectQueue('campaign-sender') private campaignQueue: Queue,
  ) {}

  async getHealth() {
    try {
      // Check database
      const dbHealthy = await this.prisma.isHealthy();

      if (!dbHealthy) {
        return {
          status: 'error',
          database: 'disconnected',
          error: 'Database connection failed',
        };
      }

      // Check queues
      const webhookWaiting = await this.webhookQueue.getWaitingCount();
      const campaignWaiting = await this.campaignQueue.getWaitingCount();
      const webhookFailed = await this.webhookQueue.getFailedCount();
      const campaignFailed = await this.campaignQueue.getFailedCount();

      return {
        status: 'ok',
        database: 'connected',
        queues: {
          webhook: {
            waiting: webhookWaiting,
            failed: webhookFailed,
          },
          campaign: {
            waiting: campaignWaiting,
            failed: campaignFailed,
          },
        },
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'error',
        error: error.message,
      };
    }
  }

  async getMetrics() {
    const webhookWaiting = await this.webhookQueue.getWaitingCount();
    const campaignWaiting = await this.campaignQueue.getWaitingCount();
    const webhookFailed = await this.webhookQueue.getFailedCount();
    const campaignFailed = await this.campaignQueue.getFailedCount();

    // Get webhook event stats
    const totalEvents = await this.prisma.webhookEvent.count();
    const processedEvents = await this.prisma.webhookEvent.count({
      where: { processed: true },
    });

    return {
      queues: {
        webhook: {
          waiting: webhookWaiting,
          failed: webhookFailed,
        },
        campaign: {
          waiting: campaignWaiting,
          failed: campaignFailed,
        },
      },
      webhooks: {
        total: totalEvents,
        processed: processedEvents,
        successRate: totalEvents > 0 ? (processedEvents / totalEvents) * 100 : 0,
      },
    };
  }
}

