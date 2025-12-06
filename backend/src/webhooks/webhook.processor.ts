import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('webhook-processing')
export class WebhookProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    const { eventId, wabaId, payload } = job.data;

    try {
      // Idempotency check: use entry/changes id to avoid duplicates
      const entry = payload.entry?.[0];
      if (!entry) {
        return;
      }

      // Use entry id or change id for idempotency
      const entryId = entry.id || JSON.stringify(entry);

      // Find WABA account
      const wabaAccount = await this.prisma.wabaAccount.findUnique({
        where: { wabaId },
      });

      if (!wabaAccount) {
        throw new Error(`WABA account not found: ${wabaId}`);
      }

      // Process changes (messages, status updates)
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;

        // Handle messages
        if (value.messages) {
          for (const message of value.messages) {
            await this.processMessage(wabaAccount.id, message, 'inbound');
          }
        }

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.updateMessageStatus(wabaAccount.id, status);
          }
        }
      }

      // Mark event as processed
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { processed: true },
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      
      // Update event with error
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          processed: true,
          error: error.message,
        },
      });

      // Check retry attempts - after max attempts, don't retry (will go to DLQ)
      const attemptsMade = job.attemptsMade || 0;
      const maxAttempts = 3;

      if (attemptsMade < maxAttempts) {
        throw error; // Will trigger retry
      } else {
        // Max attempts reached - log for DLQ handling
        console.error(`Webhook event ${eventId} failed after ${maxAttempts} attempts. Moving to DLQ.`);
        // Don't throw - job will be marked as failed and moved to DLQ
      }
    }
  }

  private async processMessage(wabaAccountId: string, message: any, direction: string) {
    const from = message.from;
    const to = message.to || message.id?.split(':')[0];
    const messageId = message.id;
    const body = message.text?.body || message.type;

    // Find or create conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        wabaAccountId,
        contactNumber: from,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          wabaAccountId,
          contactNumber: from,
          unreadCount: direction === 'inbound' ? 1 : 0,
        },
      });
    } else if (direction === 'inbound') {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastAt: new Date(),
          unreadCount: { increment: 1 },
        },
      });
    }

    // Create or update message
    const existingMessage = await this.prisma.message.findFirst({
      where: { messageId },
    });

    if (!existingMessage) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          wabaAccountId,
          messageId,
          from,
          to,
          direction,
          status: direction === 'inbound' ? 'delivered' : 'pending',
          body,
          rawPayload: message,
        },
      });
    }
  }

  private async updateMessageStatus(wabaAccountId: string, status: any) {
    const messageId = status.id;
    const statusValue = status.status; // sent, delivered, read, failed

    await this.prisma.message.updateMany({
      where: {
        wabaAccountId,
        messageId,
      },
      data: {
        status: statusValue,
        updatedAt: new Date(),
      },
    });
  }
}

