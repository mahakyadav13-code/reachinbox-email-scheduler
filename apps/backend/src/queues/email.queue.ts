import { Queue, QueueOptions } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { EmailJobData } from '../types';
import { logger } from '../config/logger';

const connection = createRedisConnection();

const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // 7 days
    },
  },
};

export const emailQueue = new Queue<EmailJobData>('email-jobs', queueOptions);

emailQueue.on('error', (error) => {
  logger.error('Email queue error:', error);
});

logger.info('Email queue initialized');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await emailQueue.close();
  logger.info('Email queue closed');
});

export async function addEmailJob(
  jobData: EmailJobData,
  options: {
    jobId: string;
    delay: number;
  }
): Promise<void> {
  try {
    await emailQueue.add('send-email', jobData, {
      jobId: options.jobId,
      delay: options.delay,
    });

    logger.debug(`Email job added: ${options.jobId}, delay: ${options.delay}ms`);
  } catch (error) {
    logger.error('Failed to add email job:', error);
    throw error;
  }
}

/**
 * Enqueue a whole campaign in one round trip.
 *
 * Campaigns can be thousands of recipients; adding them individually costs one
 * Redis round trip each. `addBulk` pipelines them. Job ids stay deterministic
 * (derived from each email's idempotency key), so re-running this for a campaign
 * that is already queued is a no-op rather than a duplicate.
 */
export async function addEmailJobsBulk(
  jobs: Array<{ data: EmailJobData; jobId: string; delay: number }>,
  chunkSize = 500
): Promise<number> {
  let queued = 0;

  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);

    try {
      await emailQueue.addBulk(
        chunk.map((job) => ({
          name: 'send-email',
          data: job.data,
          opts: { jobId: job.jobId, delay: job.delay },
        }))
      );
      queued += chunk.length;
    } catch (error) {
      logger.error(`Failed to enqueue chunk starting at index ${i}:`, error);
      throw error;
    }
  }

  logger.info(`Enqueued ${queued} email jobs`);
  return queued;
}

export async function getQueueStats() {
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
  };
}
