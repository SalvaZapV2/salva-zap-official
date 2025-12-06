import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
    @InjectQueue('campaign-sender') private campaignQueue: Queue,
  ) {}

  async getStats(wabaAccountId: string) {
    // Get date 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Count messages by status in last 24h
    const messages24h = await this.prisma.message.findMany({
      where: {
        wabaAccountId,
        direction: 'outbound',
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    const messagesSent = messages24h.length;
    const messagesDelivered = messages24h.filter((m) => m.status === 'delivered').length;
    const messagesRead = messages24h.filter((m) => m.status === 'read').length;
    const messagesFailed = messages24h.filter((m) => m.status === 'failed').length;

    // Calculate rates
    const deliveryRate = messagesSent > 0 ? (messagesDelivered / messagesSent) * 100 : 0;
    const readRate = messagesDelivered > 0 ? (messagesRead / messagesDelivered) * 100 : 0;

    // Get active conversations
    const activeConversations = await this.prisma.conversation.count({
      where: {
        wabaAccountId,
        lastAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24h
        },
      },
    });

    // Get queue sizes
    const queueSize = await this.campaignQueue.getWaitingCount();

    return {
      messages_sent_24h: messagesSent,
      messages_delivered_24h: messagesDelivered,
      messages_read_24h: messagesRead,
      messages_failed_24h: messagesFailed,
      active_conversations: activeConversations,
      queue_size: queueSize,
      delivery_rate: Math.round(deliveryRate * 100) / 100, // Round to 2 decimals
      read_rate: Math.round(readRate * 100) / 100,
    };
  }
}

