import { z } from 'zod';

export const getEmailsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  status: z.string().optional(),
});

export type GetEmailsInput = z.infer<typeof getEmailsSchema>;

export const searchEmailsSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
});

export type SearchEmailsInput = z.infer<typeof searchEmailsSchema>;
