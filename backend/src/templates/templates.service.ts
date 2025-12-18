import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionUtil } from '../common/utils/encryption.util';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TemplatesService {
  private readonly metaApiVersion: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.metaApiVersion = configService.get<string>('META_API_VERSION') || 'v21.0';
  }

  async findAll(wabaAccountId: string) {
    return this.prisma.template.findMany({
      where: { wabaAccountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async submitTemplate(wabaAccountId: string, templateData: any) {
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: wabaAccountId },
    });

    if (!wabaAccount) {
      throw new NotFoundException('WABA account not found');
    }

    const accessToken = EncryptionUtil.decrypt(wabaAccount.encryptedToken);

    try {
      // Submit to Meta
      const response = await axios.post(
        `https://graph.facebook.com/v${this.metaApiVersion}/${wabaAccount.wabaId}/message_templates`,
        templateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Store in database
      const template = await this.prisma.template.create({
        data: {
          wabaAccountId,
          name: templateData.name,
          language: templateData.language,
          status: 'submitted',
          history: {
            submitted: new Date().toISOString(),
            category: templateData.category, // Store original category for frontend
            components: templateData.components, // Store original components for frontend
            metaResponse: response.data,
          },
        },
      });

      return template;
    } catch (error) {
      console.error('Template submission error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to submit template: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  async updateStatus(id: string, status: string, history?: any) {
    const updateData: any = { status };
    if (history) {
      const template = await this.findOne(id);
      const existingHistory = (template.history as any) || {};
      updateData.history = { ...existingHistory, ...history };
    }

    return this.prisma.template.update({
      where: { id },
      data: updateData,
    });
  }
}

