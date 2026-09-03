import { Request, Response } from 'express';
import { emailService } from '../services/email.service';
import { GetEmailsInput, SearchEmailsInput } from '../validators/email.validator';
import { elasticsearchService } from '../integrations/elasticsearch/elasticsearch.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { getQueueStats } from '../queues/email.queue';

/**
 * Query params are validated + coerced by `validateQuery` middleware before the
 * handler runs, so we read them through the validator's output type rather than
 * generic-parameterising `Request` (which does not match Express' RequestHandler).
 */
export class EmailController {
  async getScheduledEmails(req: Request, res: Response) {
    const userId = req.user!.id;
    const { page, limit, status } = req.query as unknown as GetEmailsInput;

    const result = await emailService.getScheduledEmails(userId, { page, limit, status });

    res.json({
      data: result.emails,
      pagination: result.pagination,
    });
  }

  async getSentEmails(req: Request, res: Response) {
    const userId = req.user!.id;
    const { page, limit } = req.query as unknown as GetEmailsInput;

    const result = await emailService.getSentEmails(userId, { page, limit });

    res.json({
      data: result.emails,
      pagination: result.pagination,
    });
  }

  async getDashboardStats(req: Request, res: Response) {
    const userId = req.user!.id;
    const stats = await emailService.getDashboardStats(userId);

    res.json({
      data: stats,
    });
  }

  /**
   * Live BullMQ queue counters. Deployment-wide (the queue is shared), and used
   * by the in-app Queue Monitor alongside the full Bull Board dashboard.
   */
  async getQueueStats(_req: Request, res: Response) {
    const stats = await getQueueStats();

    res.json({
      data: stats,
    });
  }

  async searchEmails(req: Request, res: Response) {
    const userId = req.user!.id;
    const { q: query, page, limit } = req.query as unknown as SearchEmailsInput;

    try {
      // Prefer Elasticsearch when the cluster is reachable (retried lazily, so
      // search upgrades itself once the container finishes starting).
      if (await elasticsearchService.ensureAvailable()) {
        const result = await elasticsearchService.searchEmailJobs(userId, query, { page, limit });

        return res.json({
          data: result.jobs,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
          searchEngine: 'elasticsearch',
        });
      }

      // Fallback to SQL search so search still works without Elasticsearch.
      logger.info('Using SQL fallback for search');
      const skip = (page - 1) * limit;

      const where = {
        campaign: { userId },
        OR: [
          { recipientEmail: { contains: query, mode: 'insensitive' as const } },
          { subject: { contains: query, mode: 'insensitive' as const } },
          { body: { contains: query, mode: 'insensitive' as const } },
        ],
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
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.emailJob.count({ where }),
      ]);

      return res.json({
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        searchEngine: 'sql',
      });
    } catch (error) {
      logger.error('Search failed:', error);
      return res.status(500).json({ error: 'Search failed' });
    }
  }
}

export const emailController = new EmailController();
