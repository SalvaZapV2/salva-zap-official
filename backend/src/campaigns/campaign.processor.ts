import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { ConfigService } from '@nestjs/config';
import { RateLimiterUtil } from '../common/utils/rate-limiter.util';

@Processor('campaign-sender')
export class CampaignProcessor extends WorkerHost {
  private readonly rateLimit: number;

  constructor(
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private configService: ConfigService,
    private rateLimiter: RateLimiterUtil,
  ) {
    super();
    this.rateLimit = parseInt(configService.get<string>('RATE_LIMIT_DEFAULT') || '10');
  }

  async process(job: Job) {
    const { campaignId, jobId, wabaAccountId, templateId, toNumber } = job.data;

    try {
      // Get WABA account to get phoneId for rate limiting
      const wabaAccount = await this.prisma.wabaAccount.findUnique({
        where: { id: wabaAccountId },
      });

      if (!wabaAccount) {
        throw new Error('WABA account not found');
      }

      // Rate limiting: Use Redis token bucket per phoneId
      await this.rateLimiter.waitForRateLimit(wabaAccount.phoneId, this.rateLimit, this.rateLimit);

      if (templateId) {
        // Send template message
        const template = await this.prisma.template.findUnique({
          where: { id: templateId },
        });

        if (template && template.status === 'approved') {
          await this.messagesService.sendTemplateMessage(
            wabaAccountId,
            toNumber,
            template.name,
            template.language,
          );
        } else {
          throw new Error('Template not approved');
        }
      } else {
        // Send plain text message (24h window)
        await this.messagesService.sendMessage(wabaAccountId, toNumber, 'Campaign message');
      }

      // Update job status
      await this.prisma.campaignJob.update({
        where: { id: jobId },
        data: {
          status: 'sent',
          attempts: { increment: 1 },
        },
      });

      // Check if campaign is complete
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { jobs: true },
      });

      if (campaign) {
        const pendingJobs = campaign.jobs.filter((j) => j.status === 'pending');
        if (pendingJobs.length === 0) {
          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'completed' },
          });
        }
      }
    } catch (error) {
      console.error('Campaign job error:', error);

      // Update job with error
      await this.prisma.campaignJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastError: error.message,
        },
      });

      // Retry logic: retry up to 3 times
      const job = await this.prisma.campaignJob.findUnique({
        where: { id: jobId },
      });

      if (job && job.attempts < 3) {
        throw error; // Will trigger retry
      }
    }
  }
}

