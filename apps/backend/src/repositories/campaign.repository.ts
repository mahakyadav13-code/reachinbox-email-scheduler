import { prisma } from '../config/database';
import { EmailCampaign } from '../types';

export class CampaignRepository {
  async findById(id: string): Promise<EmailCampaign | null> {
    return prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        sender: true,
        emailJobs: {
          take: 5,
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
  }

  async findByUserId(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ campaigns: EmailCampaign[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where: { userId },
        include: {
          sender: true,
          _count: {
            select: { emailJobs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailCampaign.count({ where: { userId } }),
    ]);

    return { campaigns, total };
  }

  async create(data: {
    userId: string;
    senderId: string;
    subject: string;
    body: string;
    startTime: Date;
    delayBetweenEmails: number;
    hourlyLimit: number;
    totalEmails: number;
    status?: string;
  }): Promise<EmailCampaign> {
    return prisma.emailCampaign.create({ data });
  }

  async update(id: string, data: Partial<EmailCampaign>): Promise<EmailCampaign> {
    return prisma.emailCampaign.update({
      where: { id },
      data,
    });
  }

  async getCampaignStats(campaignId: string) {
    const stats = await prisma.emailJob.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    return stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const campaignRepository = new CampaignRepository();
