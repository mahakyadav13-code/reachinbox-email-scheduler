import { prisma } from '../config/database';
import { EmailJob, EmailJobStatus } from '../types';

export class EmailJobRepository {
  async findById(id: string): Promise<EmailJob | null> {
    return prisma.emailJob.findUnique({ where: { id } });
  }

  async findByIdempotencyKey(key: string): Promise<EmailJob | null> {
    return prisma.emailJob.findUnique({ where: { idempotencyKey: key } });
  }

  async findScheduledEmails(
    userId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const { page = 1, limit = 50, status } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      campaign: { userId },
      status: status || { in: ['pending', 'processing', 'delayed'] },
    };

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        include: {
          sender: true,
          campaign: {
            select: { id: true, subject: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({ where }),
    ]);

    return { jobs, total };
  }

  async findSentEmails(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      campaign: { userId },
      status: { in: ['sent', 'failed'] },
    };

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        include: {
          sender: true,
          campaign: {
            select: { id: true, subject: true },
          },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({ where }),
    ]);

    return { jobs, total };
  }

  async createBatch(jobs: Array<{
    campaignId: string;
    senderId: string;
    recipientEmail: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    idempotencyKey: string;
    bullJobId: string;
  }>): Promise<void> {
    await prisma.emailJob.createMany({
      data: jobs,
      skipDuplicates: true,
    });
  }

  async updateStatus(
    id: string,
    status: EmailJobStatus,
    additionalData?: {
      sentAt?: Date;
      failureReason?: string;
    }
  ): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  async countByStatus(campaignId: string, status: string): Promise<number> {
    return prisma.emailJob.count({
      where: { campaignId, status },
    });
  }

  async getDashboardStats(userId: string) {
    const [totalScheduled, sentToday, failed, queueWaiting] = await Promise.all([
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: { in: ['pending', 'processing', 'delayed'] },
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: 'sent',
          sentAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: 'failed',
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: 'pending',
        },
      }),
    ]);

    return {
      totalScheduled,
      sentToday,
      failed,
      queueWaiting,
    };
  }
}

export const emailJobRepository = new EmailJobRepository();
