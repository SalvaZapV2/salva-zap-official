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
        const field = change.field;

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

        // Handle template status updates
        // Meta can send this in different formats:
        // 1. As an array in value.message_template_status_update
        // 2. As a single object when field === "message_template_status_update"
        if (field === 'message_template_status_update' && value.event) {
          // Single template status update
          await this.updateTemplateStatus(wabaAccount.id, value);
        } else if (value.message_template_status_update) {
          // Array of template status updates
          const updates = Array.isArray(value.message_template_status_update)
            ? value.message_template_status_update
            : [value.message_template_status_update];
          for (const update of updates) {
            await this.updateTemplateStatus(wabaAccount.id, update);
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

  private async updateTemplateStatus(wabaAccountId: string, update: any) {
    // Meta sends template status updates with event: APPROVED, REJECTED, etc.
    const event = update.event;
    const templateName = update.name || update.message_template_name;
    
    if (!templateName) {
      console.warn('Template status update missing template name:', update);
      return;
    }

    // Find template by name and wabaAccountId
    const template = await this.prisma.template.findFirst({
      where: {
        wabaAccountId,
        name: templateName,
      },
    });

    if (!template) {
      console.warn(`Template not found for status update: ${templateName} (WABA: ${wabaAccountId})`);
      return;
    }

    // Map Meta events to our status values
    let status: string;
    if (event === 'APPROVED') {
      status = 'approved';
    } else if (event === 'REJECTED') {
      status = 'rejected';
    } else {
      // Keep existing status for other events
      status = template.status;
    }

    // Update template with new status and history
    const existingHistory = (template.history as any) || {};
    const historyUpdate: any = {
      ...existingHistory,
      statusUpdate: update,
    };

    // Store event timestamp
    historyUpdate[event.toLowerCase()] = new Date().toISOString();
    
    // Explicitly store 'approved' timestamp for frontend compatibility
    if (event === 'APPROVED') {
      historyUpdate.approved = new Date().toISOString();
    }

    await this.prisma.template.update({
      where: { id: template.id },
      data: {
        status,
        history: historyUpdate,
      },
    });
  }
}

