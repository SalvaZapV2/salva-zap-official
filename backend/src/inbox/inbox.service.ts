import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxService {
  constructor(private prisma: PrismaService) {}

  async getConversations(wabaAccountId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { wabaAccountId },
        orderBy: { lastAt: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.conversation.count({
        where: { wabaAccountId },
      }),
    ]);

    return {
      data: conversations.map((conv) => ({
        id: conv.id,
        contactNumber: conv.contactNumber,
        lastMessage: conv.messages[0]?.body || '',
        lastMessageAt: conv.lastAt,
        unreadCount: conv.unreadCount,
        status: 'open', // TODO: Add status field to schema
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversationMessages(conversationId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: { conversationId },
      }),
    ]);

    return {
      data: messages.reverse().map((msg) => ({
        id: msg.id,
        direction: msg.direction,
        content: msg.body || '',
        timestamp: msg.createdAt,
        status: msg.status,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

