import { campaignRepository } from '../repositories/campaign.repository';
import { senderRepository } from '../repositories/sender.repository';
import { emailJobRepository } from '../repositories/email-job.repository';
import { parseEmails } from '../utils/email-parser';
import { calculateScheduledTimes, calculateDelay } from '../utils/scheduling';
import { generateIdempotencyKey, generateBullJobId } from '../utils/idempotency';
import { addEmailJobsBulk } from '../queues/email.queue';
import { config } from '../config';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { EmailCampaign, EmailJobData } from '../types';

interface CreateCampaignData {
  userId: string;
  subject: string;
  body: string;
  senderId: string;
  recipients: string;
  fileType: 'csv' | 'txt';
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export class CampaignService {
  async createCampaign(data: CreateCampaignData): Promise<{
    campaign: EmailCampaign;
    stats: {
      totalScheduled: number;
      validEmails: number;
      invalidEmails: number;
      duplicatesRemoved: number;
    };
  }> {
    // Verify sender belongs to user
    const sender = await senderRepository.findById(data.senderId);
    if (!sender) {
      throw new NotFoundError('Sender not found');
    }
    if (sender.userId !== data.userId) {
      throw new ForbiddenError('Sender does not belong to user');
    }

    // Parse and validate emails
    const parseResult = parseEmails(data.recipients, data.fileType);
    
    if (parseResult.validEmails.length === 0) {
      throw new ValidationError('No valid email addresses found');
    }

    logger.info(`Parsed ${parseResult.validEmails.length} valid emails from ${data.fileType}`);

    // Parse start time
    const startTime = new Date(data.startTime);
    if (isNaN(startTime.getTime())) {
      throw new ValidationError('Invalid start time');
    }

    // A provider-throttling floor is always applied: a caller may ask for a
    // wider gap between sends than MIN_DELAY_BETWEEN_EMAILS_SECONDS, never a
    // narrower one.
    const minDelay = config.scheduling.minDelayBetweenEmailsSeconds;
    const delayBetweenEmails = Math.max(data.delayBetweenEmails, minDelay);

    if (delayBetweenEmails !== data.delayBetweenEmails) {
      logger.info(
        `Requested delay ${data.delayBetweenEmails}s raised to the configured minimum of ${minDelay}s`
      );
    }

    // Validate start time is not too far in the past
    const now = new Date();
    if (startTime < new Date(now.getTime() - 60000)) {
      throw new ValidationError('Start time cannot be in the past');
    }

    // Create campaign
    const campaign = await campaignRepository.create({
      userId: data.userId,
      senderId: data.senderId,
      subject: data.subject,
      body: data.body,
      startTime,
      delayBetweenEmails,
      hourlyLimit: data.hourlyLimit,
      totalEmails: parseResult.validEmails.length,
      status: 'scheduled',
    });

    logger.info(`Campaign created: ${campaign.id}`);

    // Calculate scheduled times for all emails
    const scheduledTimes = calculateScheduledTimes(
      startTime,
      parseResult.validEmails.length,
      delayBetweenEmails
    );

    // Create email jobs
    const emailJobs = parseResult.validEmails.map((email, index) => {
      const scheduledAt = scheduledTimes[index];
      const idempotencyKey = generateIdempotencyKey(campaign.id, email, scheduledAt);
      const bullJobId = generateBullJobId(idempotencyKey);

      return {
        campaignId: campaign.id,
        senderId: data.senderId,
        recipientEmail: email,
        subject: data.subject,
        body: data.body,
        scheduledAt,
        idempotencyKey,
        bullJobId,
      };
    });

    // Insert all email jobs into database
    await emailJobRepository.createBatch(emailJobs);
    logger.info(`Created ${emailJobs.length} email job records`);

    // Add jobs to BullMQ as delayed jobs, in bulk.
    const jobsQueued = await addEmailJobsBulk(
      emailJobs.map((job) => ({
        jobId: job.bullJobId,
        delay: calculateDelay(job.scheduledAt),
        data: {
          // The worker resolves the DB row by idempotency key, which is stable
          // across restarts and reschedules.
          emailJobId: job.bullJobId,
          campaignId: job.campaignId,
          senderId: job.senderId,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          body: job.body,
          scheduledAt: job.scheduledAt.toISOString(),
          idempotencyKey: job.idempotencyKey,
        } satisfies EmailJobData,
      }))
    );

    logger.info(`Queued ${jobsQueued}/${emailJobs.length} jobs in BullMQ`);

    // Index immediately so scheduled (not just sent) emails are searchable.
    // Fire-and-forget: search indexing must never delay or fail scheduling.
    void this.indexCampaignForSearch(campaign.id);

    return {
      campaign,
      stats: {
        totalScheduled: parseResult.validEmails.length,
        validEmails: parseResult.validEmails.length,
        invalidEmails: parseResult.invalidEmails.length,
        duplicatesRemoved: parseResult.duplicates.length,
      },
    };
  }

  /**
   * Push a newly created campaign's jobs into the search index in batches.
   */
  private async indexCampaignForSearch(campaignId: string): Promise<void> {
    try {
      const { elasticsearchService } = await import(
        '../integrations/elasticsearch/elasticsearch.service'
      );
      const { prisma } = await import('../config/database');

      const batchSize = 500;
      let cursor: string | undefined;

      for (;;) {
        const batch = await prisma.emailJob.findMany({
          where: { campaignId },
          include: {
            sender: true,
            campaign: { select: { userId: true } },
          },
          orderBy: { id: 'asc' },
          take: batchSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (batch.length === 0) break;

        await elasticsearchService.indexEmailJobsBulk(batch);
        if (batch.length < batchSize) break;
        cursor = batch[batch.length - 1].id;
      }
    } catch (error) {
      logger.error('Failed to index campaign for search:', error);
    }
  }

  async getCampaigns(userId: string, page: number = 1, limit: number = 20) {
    const { campaigns, total } = await campaignRepository.findByUserId(userId, {
      page,
      limit,
    });

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCampaignById(campaignId: string, userId: string) {
    const campaign = await campaignRepository.findById(campaignId);
    
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.userId !== userId) {
      throw new ForbiddenError('Access denied');
    }

    // Get campaign stats
    const stats = await campaignRepository.getCampaignStats(campaignId);

    return {
      campaign,
      stats,
    };
  }
}

export const campaignService = new CampaignService();
