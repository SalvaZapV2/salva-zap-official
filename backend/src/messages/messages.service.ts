import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionUtil } from '../common/utils/encryption.util';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

@Injectable()
export class MessagesService {
  private readonly metaApiVersion: string;
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Normalize API version - remove 'v' prefix if present
    const apiVersion = configService.get<string>('META_API_VERSION') || '21.0';
    this.metaApiVersion = apiVersion.startsWith('v') ? apiVersion.substring(1) : apiVersion;
  }

  async sendMessage(wabaAccountId: string, to: string, body: string, clientMessageId?: string) {
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: wabaAccountId },
    });

    if (!wabaAccount) {
      throw new NotFoundException('WABA account not found');
    }

    // Idempotency check: if clientMessageId provided, check for duplicate
    if (clientMessageId) {
      const existingMessages = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM \`Message\`
        WHERE wabaAccountId = ${wabaAccountId}
        AND JSON_EXTRACT(rawPayload, '$.clientMessageId') = ${clientMessageId}
        LIMIT 1
      `;

      if (existingMessages && existingMessages.length > 0) {
        const existingMessage = await this.prisma.message.findUnique({
          where: { id: existingMessages[0].id },
        });
        if (existingMessage) {
          return existingMessage; // Return existing message for idempotency
        }
      }
    }

    const accessToken = EncryptionUtil.decrypt(wabaAccount.encryptedToken);

    try {
      // Build payload with idempotency key if provided
      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      };

      // Add idempotency key if provided (Meta supports this in some APIs)
      if (clientMessageId) {
        // Store in rawPayload for our own idempotency tracking
        payload.metadata = { clientMessageId };
      }

      // Send via Meta Graph API
      const response = await axios.post(
        `https://graph.facebook.com/v${this.metaApiVersion}/${wabaAccount.phoneId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const messageId = response.data.messages[0].id;

      // Find or create conversation
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          wabaAccountId,
          contactNumber: to,
        },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            wabaAccountId,
            contactNumber: to,
          },
        });
      }

      // Store message with clientMessageId in rawPayload if provided
      const rawPayload: any = { ...response.data };
      if (clientMessageId) {
        rawPayload.clientMessageId = clientMessageId;
      }

      // Store message
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          wabaAccountId,
          messageId,
          from: wabaAccount.phoneId,
          to,
          direction: 'outbound',
          status: 'pending', // Start as pending, update via webhook
          body,
          rawPayload,
        },
      });

      return message;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || error.response?.status;
      
      this.logger.error(
        `Failed to send message to ${to} via WABA ${wabaAccountId}`,
        {
          error: errorMessage,
          code: errorCode,
          response: error.response?.data,
          stack: error.stack,
        },
      );

      // Handle specific Meta API errors
      if (error.response?.status === 429) {
        throw new BadRequestException('Rate limit exceeded. Please try again later.');
      }
      
      if (error.response?.status === 403) {
        throw new BadRequestException('Permission denied. Please check WABA account permissions.');
      }

      throw new BadRequestException(`Failed to send message: ${errorMessage}`);
    }
  }

  async sendTemplateMessage(
    wabaAccountId: string,
    to: string,
    templateName: string,
    language: string,
    parameters?: any[],
    clientMessageId?: string,
  ) {
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: wabaAccountId },
    });

    if (!wabaAccount) {
      this.logger.warn(`WABA account not found: ${wabaAccountId}`);
      throw new NotFoundException('WABA account not found');
    }

    // Idempotency check: if clientMessageId provided, check for duplicate
    if (clientMessageId) {
      const existingMessages = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM \`Message\`
        WHERE wabaAccountId = ${wabaAccountId}
        AND JSON_EXTRACT(rawPayload, '$.clientMessageId') = ${clientMessageId}
        LIMIT 1
      `;

      if (existingMessages && existingMessages.length > 0) {
        const existingMessage = await this.prisma.message.findUnique({
          where: { id: existingMessages[0].id },
        });
        if (existingMessage) {
          this.logger.debug(`Duplicate message detected (idempotency): ${clientMessageId}`);
          return existingMessage; // Return existing message for idempotency
        }
      }
    }

    const accessToken = EncryptionUtil.decrypt(wabaAccount.encryptedToken);

    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
        },
      };

      if (parameters && parameters.length > 0) {
        payload.template.components = [
          {
            type: 'body',
            parameters: parameters.map((p) => ({ type: 'text', text: p })),
          },
        ];
      }

      const response = await axios.post(
        `https://graph.facebook.com/v${this.metaApiVersion}/${wabaAccount.phoneId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const messageId = response.data.messages[0].id;

      // Find or create conversation
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          wabaAccountId,
          contactNumber: to,
        },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            wabaAccountId,
            contactNumber: to,
          },
        });
      }

      // Store message with clientMessageId in rawPayload if provided
      const rawPayload: any = { ...response.data };
      if (clientMessageId) {
        rawPayload.clientMessageId = clientMessageId;
      }

      // Store message
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          wabaAccountId,
          messageId,
          from: wabaAccount.phoneId,
          to,
          direction: 'outbound',
          status: 'sent',
          body: `Template: ${templateName}`,
          rawPayload,
        },
      });

      return message;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || error.response?.status;
      
      this.logger.error(
        `Failed to send template message ${templateName} to ${to} via WABA ${wabaAccountId}`,
        {
          error: errorMessage,
          code: errorCode,
          template: templateName,
          language,
          response: error.response?.data,
          stack: error.stack,
        },
      );

      // Handle specific Meta API errors
      if (error.response?.status === 429) {
        throw new BadRequestException('Rate limit exceeded. Please try again later.');
      }
      
      if (error.response?.status === 404 && error.response?.data?.error?.message?.includes('template')) {
        throw new BadRequestException(`Template ${templateName} not found or not approved.`);
      }

      throw new BadRequestException(`Failed to send template: ${errorMessage}`);
    }
  }
}

