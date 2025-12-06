import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhooksService {
  private readonly verifyToken: string;
  private readonly appSecret: string;
  private readonly logger = new Logger(WebhooksService.name);
  private signatureFailCount = 0;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
  ) {
    this.verifyToken = configService.get<string>('META_VERIFY_TOKEN') || 'default-verify-token';
    this.appSecret = configService.get<string>('META_APP_SECRET') || '';
  }

  verifyChallenge(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    return null;
  }

  verifySignature(signature: string, payload: string): boolean {
    if (!signature || !this.appSecret) {
      this.logger.warn('Missing signature or app secret');
      this.signatureFailCount++;
      this.checkSignatureFailRate();
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature),
    );

    if (!isValid) {
      this.logger.warn('Invalid webhook signature detected');
      this.signatureFailCount++;
      this.checkSignatureFailRate();
    } else {
      // Reset counter on success
      this.signatureFailCount = Math.max(0, this.signatureFailCount - 1);
    }

    return isValid;
  }

  private checkSignatureFailRate() {
    // Alert if signature fail rate is high (example: > 10 failures in short time)
    if (this.signatureFailCount > 10) {
      this.logger.error(
        `HIGH SIGNATURE FAILURE RATE: ${this.signatureFailCount} failures detected. ` +
        'Please verify META_APP_SECRET configuration.',
      );
    }
  }

  async processWebhookEvent(wabaId: string, rawBody: any, headers: any) {
    // Store raw event
    const event = await this.prisma.webhookEvent.create({
      data: {
        wabaId,
        rawBody,
        headers,
      },
    });

    // Enqueue for processing
    await this.webhookQueue.add('process-webhook', {
      eventId: event.id,
      wabaId,
      payload: rawBody,
    });

    return event;
  }

  async replayEvent(eventId: string) {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    await this.webhookQueue.add('process-webhook', {
      eventId: event.id,
      wabaId: event.wabaId,
      payload: event.rawBody,
    });

    return { message: 'Event replayed' };
  }
}

