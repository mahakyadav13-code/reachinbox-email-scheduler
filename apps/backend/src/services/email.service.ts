import { emailJobRepository } from '../repositories/email-job.repository';

export class EmailService {
  async getScheduledEmails(
    userId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const { jobs, total } = await emailJobRepository.findScheduledEmails(userId, options);

    return {
      emails: jobs,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 50,
        total,
        totalPages: Math.ceil(total / (options.limit || 50)),
      },
    };
  }

  async getSentEmails(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { jobs, total } = await emailJobRepository.findSentEmails(userId, options);

    return {
      emails: jobs,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 50,
        total,
        totalPages: Math.ceil(total / (options.limit || 50)),
      },
    };
  }

  async getDashboardStats(userId: string) {
    return emailJobRepository.getDashboardStats(userId);
  }
}

export const emailService = new EmailService();
