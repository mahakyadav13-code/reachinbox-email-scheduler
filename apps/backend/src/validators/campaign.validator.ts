import { z } from 'zod';

export const createCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject too long'),
  body: z.string().min(1, 'Email body is required'),
  senderId: z.string().min(1, 'Sender is required'),
  recipients: z.string().min(1, 'Recipients are required'), // CSV or newline-separated
  fileType: z.enum(['csv', 'txt']),
  startTime: z.string().datetime('Invalid start time format'),
  delayBetweenEmails: z.number().int().min(0, 'Delay must be non-negative'),
  hourlyLimit: z.number().int().min(1, 'Hourly limit must be at least 1'),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const getCampaignsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
});

export type GetCampaignsInput = z.infer<typeof getCampaignsSchema>;
