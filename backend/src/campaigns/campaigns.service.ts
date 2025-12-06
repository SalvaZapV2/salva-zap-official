import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('campaign-sender') private campaignQueue: Queue,
  ) {}

  async create(wabaAccountId: string, templateId: string | null, contactNumbers: string[]) {
    // Validate WABA account exists
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: wabaAccountId },
    });

    if (!wabaAccount) {
      this.logger.warn(`WABA account not found: ${wabaAccountId}`);
      throw new NotFoundException('WABA account not found');
    }

    // Validate template if provided
    if (templateId) {
      const template = await this.prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        this.logger.warn(`Template not found: ${templateId}`);
        throw new NotFoundException('Template not found');
      }

      if (template.status !== 'approved') {
        this.logger.warn(`Template ${templateId} is not approved (status: ${template.status})`);
        throw new BadRequestException(`Template must be approved. Current status: ${template.status}`);
      }

      if (template.wabaAccountId !== wabaAccountId) {
        this.logger.warn(`Template ${templateId} does not belong to WABA ${wabaAccountId}`);
        throw new BadRequestException('Template does not belong to this WABA account');
      }
    }

    // Validate contact numbers
    if (!contactNumbers || contactNumbers.length === 0) {
      throw new BadRequestException('Contact numbers list cannot be empty');
    }

    if (contactNumbers.length > 10000) {
      this.logger.warn(`Campaign with ${contactNumbers.length} contacts exceeds recommended limit`);
    }

    try {
      const campaign = await this.prisma.campaign.create({
        data: {
          wabaAccountId,
          templateId,
          contactCount: contactNumbers.length,
          status: 'created',
        },
      });

      this.logger.log(`Created campaign ${campaign.id} with ${contactNumbers.length} contacts`);

      // Create campaign jobs
      const jobs = await Promise.all(
        contactNumbers.map((toNumber) =>
          this.prisma.campaignJob.create({
            data: {
              campaignId: campaign.id,
              toNumber,
              status: 'pending',
            },
          }),
        ),
      );

      this.logger.log(`Created ${jobs.length} campaign jobs for campaign ${campaign.id}`);

      // Enqueue jobs for processing
      let enqueuedCount = 0;
      for (const job of jobs) {
        try {
          await this.campaignQueue.add('send-campaign-message', {
            campaignId: campaign.id,
            jobId: job.id,
            wabaAccountId,
            templateId,
            toNumber: job.toNumber,
          });
          enqueuedCount++;
        } catch (error) {
          this.logger.error(`Failed to enqueue job ${job.id}:`, error);
          // Continue with other jobs even if one fails
        }
      }

      this.logger.log(`Enqueued ${enqueuedCount}/${jobs.length} jobs for campaign ${campaign.id}`);

      // Update campaign status
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'sending' },
      });

      return campaign;
    } catch (error) {
      this.logger.error(`Failed to create campaign for WABA ${wabaAccountId}:`, error);
      throw error;
    }
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        jobs: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const sentCount = campaign.jobs.filter((j) => j.status === 'sent').length;
    const failedCount = campaign.jobs.filter((j) => j.status === 'failed').length;

    // Get sent job phone numbers
    const sentJobNumbers = campaign.jobs
      .filter((j) => j.status === 'sent')
      .map((j) => j.toNumber);

    // Count messages by status for campaign phone numbers
    let deliveredCount = 0;
    let readCount = 0;

    if (sentJobNumbers.length > 0) {
      const messages = await this.prisma.message.findMany({
        where: {
          wabaAccountId: campaign.wabaAccountId,
          to: {
            in: sentJobNumbers,
          },
          direction: 'outbound',
          createdAt: {
            gte: campaign.createdAt, // Messages created after campaign start
          },
        },
      });

      deliveredCount = messages.filter((m) => m.status === 'delivered').length;
      readCount = messages.filter((m) => m.status === 'read').length;
    }

    return {
      ...campaign,
      sentCount,
      failedCount,
      deliveredCount,
      readCount,
    };
  }

  async findAll(wabaAccountId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { wabaAccountId },
      include: {
        jobs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (campaigns.length === 0) {
      return [];
    }

    // Get earliest campaign date for optimization
    const earliestCampaignDate = campaigns.reduce((earliest, campaign) => {
      return campaign.createdAt < earliest ? campaign.createdAt : earliest;
    }, campaigns[0].createdAt);

    // Get all messages for this WABA after earliest campaign date
    // Then filter by campaign in memory for better performance
    const allMessages = await this.prisma.message.findMany({
      where: {
        wabaAccountId,
        direction: 'outbound',
        createdAt: {
          gte: earliestCampaignDate,
        },
      },
      select: {
        to: true,
        status: true,
        createdAt: true,
      },
    });

    // Group messages by campaign based on phone number and creation time
    const messagesByCampaign = new Map<string, any[]>();

    return campaigns.map((campaign) => {
      const sentCount = campaign.jobs.filter((j) => j.status === 'sent').length;
      const failedCount = campaign.jobs.filter((j) => j.status === 'failed').length;

      const sentJobNumbers = campaign.jobs
        .filter((j) => j.status === 'sent')
        .map((j) => j.toNumber);

      // Filter messages for this campaign (matching phone numbers and after campaign creation)
      const campaignMessages = allMessages.filter(
        (m) =>
          sentJobNumbers.includes(m.to) &&
          m.createdAt >= campaign.createdAt,
      );

      const deliveredCount = campaignMessages.filter((m) => m.status === 'delivered').length;
      const readCount = campaignMessages.filter((m) => m.status === 'read').length;

      return {
        ...campaign,
        sentCount,
        failedCount,
        deliveredCount,
        readCount,
      };
    });
  }
}

