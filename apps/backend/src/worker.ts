import { Worker, Job } from 'bullmq';
import { createRedisConnection, redis } from './config/redis';
import { prisma } from './config/database';
import { logger } from './config/logger';
import { config } from './config';
import { EmailJobData, EmailJobStatus } from './types';
import { smtpService } from './integrations/email/smtp.service';
import { rateLimitService } from './services/rate-limit.service';
import { calculateDelay } from './utils/scheduling';
import { addEmailJob } from './queues/email.queue';
import { rescheduleJobId } from './utils/idempotency';

const connection = createRedisConnection();

/**
 * Spacing used when pushing a rejected job into a later window.
 *
 * Wide enough that the rescheduled batch fits inside the hour without
 * immediately tripping the limit again, but never tighter than the configured
 * minimum delay between sends.
 */
function rescheduleSpacingSeconds(effectiveLimit: number): number {
  const evenlySpread = Math.floor(3600 / Math.max(effectiveLimit, 1));
  return Math.max(config.scheduling.minDelayBetweenEmailsSeconds, evenlySpread);
}

const worker = new Worker<EmailJobData>(
  'email-jobs',
  async (job: Job<EmailJobData>) => {
    const { data } = job;

    logger.info(`Processing job ${job.id} for ${data.recipientEmail}`);

    // 1. Load the job row plus the sender and the campaign's configured limit.
    const emailJob = await prisma.emailJob.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: {
        sender: true,
        campaign: { select: { id: true, userId: true, hourlyLimit: true } },
      },
    });

    if (!emailJob) {
      logger.error(`Email job not found for idempotency key: ${data.idempotencyKey}`);
      return;
    }

    // 2. Idempotency short-circuit for anything already finished.
    if (emailJob.status === EmailJobStatus.SENT) {
      logger.info(`Email already sent to ${data.recipientEmail}, skipping`);
      return;
    }

    const effectiveLimit = rateLimitService.resolveLimit(emailJob.campaign.hourlyLimit);

    // 3. Rate limit check, scoped to this campaign's effective hourly limit.
    const rateLimitResult = await rateLimitService.checkAndIncrement(
      data.senderId,
      effectiveLimit
    );

    if (!rateLimitResult.allowed) {
      await handleRateLimited(job, emailJob, rateLimitResult, effectiveLimit);
      return;
    }

    // 4. Atomically claim the job. Only one worker can move a row out of
    //    pending/delayed, so a duplicate delivery of the same work cannot
    //    result in two sends even across multiple worker processes.
    const claim = await prisma.emailJob.updateMany({
      where: {
        idempotencyKey: data.idempotencyKey,
        status: { in: [EmailJobStatus.PENDING, EmailJobStatus.DELAYED] },
      },
      data: { status: EmailJobStatus.PROCESSING },
    });

    if (claim.count === 0) {
      // Another worker owns this email. Give back the reservation we took so the
      // hourly budget is not consumed by a send we are not performing.
      await rateLimitService.decrement(data.senderId);
      logger.warn(
        `Could not claim job for ${data.recipientEmail} (status=${emailJob.status}), skipping duplicate`
      );
      return;
    }

    try {
      // 5. Send via Ethereal SMTP.
      await smtpService.initialize();

      const result = await smtpService.sendEmail({
        from: `${emailJob.sender.name} <${emailJob.sender.email}>`,
        to: data.recipientEmail,
        subject: data.subject,
        text: data.body,
        html: data.body,
      });

      logger.info(`Email sent successfully: ${result.messageId}`);
      if (result.previewUrl) {
        logger.info(`Preview URL: ${result.previewUrl}`);
      }

      // 6. Mark as sent.
      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: {
          status: EmailJobStatus.SENT,
          sentAt: new Date(),
        },
      });

      // 7. Index for search. Never fatal to the send.
      await indexEmailJob(emailJob.id);

      logger.info(`Successfully processed job ${job.id} for ${data.recipientEmail}`);
    } catch (error: any) {
      logger.error(`Failed to process job ${job.id}:`, error);

      // The send did not happen, so return the reserved slot to the hour budget.
      await rateLimitService.decrement(data.senderId);

      try {
        await prisma.emailJob.update({
          where: { idempotencyKey: data.idempotencyKey },
          data: {
            status:
              job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
                ? EmailJobStatus.FAILED
                : EmailJobStatus.PENDING,
            failureReason: error.message || 'Unknown error',
          },
        });
      } catch (dbError) {
        logger.error('Failed to update job status:', dbError);
      }

      throw error; // Let BullMQ handle the retry/backoff.
    }
  },
  {
    connection,
    concurrency: config.worker.concurrency,
    limiter: {
      // Throughput ceiling for the worker as a whole. Per-recipient pacing comes
      // from each job's own delay; this exists to stop a large backlog of
      // already-due jobs from hammering SMTP all at once.
      max: config.worker.concurrency,
      duration: config.scheduling.minDelayBetweenEmailsSeconds * 1000,
    },
  }
);

/**
 * Push a rate-limited job into the next window, preserving relative order and
 * spacing sends out inside that window. Notifies Slack once per sender/window.
 */
async function handleRateLimited(
  job: Job<EmailJobData>,
  emailJob: { id: string; sender: { email: string }; campaign: { userId: string } },
  rateLimitResult: Awaited<ReturnType<typeof rateLimitService.checkAndIncrement>>,
  effectiveLimit: number
) {
  const { data } = job;
  const nextWindow = rateLimitResult.nextAvailableTime!;

  logger.warn(
    `Rate limit reached for sender ${data.senderId} ` +
      `(${rateLimitResult.currentCount}/${rateLimitResult.limit} in ${rateLimitResult.hourWindow})`
  );

  // Order-preserving position within the target window.
  const sequence = await rateLimitService.nextRescheduleSequence(data.senderId, nextWindow);
  const spacing = rescheduleSpacingSeconds(effectiveLimit);
  const targetTime = new Date(nextWindow.getTime() + (sequence - 1) * spacing * 1000);
  const delay = calculateDelay(targetTime);

  await prisma.emailJob.update({
    where: { id: emailJob.id },
    data: {
      status: EmailJobStatus.DELAYED,
      scheduledAt: targetTime,
    },
  });

  // Deterministic job id derived from the idempotency key and the target window,
  // so a replay of this same rejection cannot create a second queued copy.
  await addEmailJob(data, {
    jobId: rescheduleJobId(data.idempotencyKey, targetTime),
    delay,
  });

  logger.info(
    `Rescheduled ${data.recipientEmail} to ${targetTime.toISOString()} ` +
      `(position ${sequence}, spacing ${spacing}s)`
  );

  // One notification per sender per window, not one per blocked email.
  const shouldNotify = await rateLimitService.claimLimitNotification(
    data.senderId,
    rateLimitResult.hourWindow
  );

  if (!shouldNotify) return;

  try {
    const { slackService } = await import('./integrations/slack/slack.service');
    await slackService.sendRateLimitNotification(emailJob.campaign.userId, {
      senderEmail: emailJob.sender.email,
      hourlyLimit: rateLimitResult.limit,
      currentWindow: rateLimitResult.hourWindow,
      currentCount: rateLimitResult.currentCount,
      nextWindowAt: nextWindow,
    });
  } catch (slackError) {
    // A missing or broken Slack connection must never fail an email job.
    logger.error('Failed to send Slack notification:', slackError);
  }
}

async function indexEmailJob(emailJobId: string) {
  try {
    const { elasticsearchService } = await import(
      './integrations/elasticsearch/elasticsearch.service'
    );

    const jobWithRelations = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: {
        sender: true,
        campaign: { select: { userId: true } },
      },
    });

    if (jobWithRelations) {
      await elasticsearchService.indexEmailJob(jobWithRelations);
    }
  } catch (esError) {
    logger.error('Failed to index in Elasticsearch:', esError);
  }
}

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
  logger.error(`Job ${job?.id} failed:`, error);
});

worker.on('error', (error) => {
  logger.error('Worker error:', error);
});

const startWorker = async () => {
  try {
    logger.info('Worker process starting...');
    logger.info(`Worker concurrency: ${config.worker.concurrency}`);
    logger.info(`Max emails per hour per sender: ${config.rateLimit.maxEmailsPerHourPerSender}`);
    logger.info(
      `Minimum delay between sends: ${config.scheduling.minDelayBetweenEmailsSeconds}s`
    );

    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Initialize Elasticsearch (non-blocking)
    const { elasticsearchService } = await import(
      './integrations/elasticsearch/elasticsearch.service'
    );
    elasticsearchService.initialize().catch((error) => {
      logger.warn('Elasticsearch initialization failed in worker:', error);
    });

    logger.info('Worker process ready and listening for jobs');
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down worker gracefully...');

  // Close the worker first so in-flight jobs finish (or are returned to the
  // queue) before the connections they depend on go away.
  await worker.close();
  await smtpService.close();
  await prisma.$disconnect();
  await connection.quit();
  // Shared client used by the rate limiter - separate from the BullMQ connection.
  await redis.quit();

  logger.info('Worker shut down complete');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startWorker();
