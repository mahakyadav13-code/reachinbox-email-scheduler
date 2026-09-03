import { z } from 'zod';

export const createSenderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  provider: z.string().default('ethereal'),
});

export type CreateSenderInput = z.infer<typeof createSenderSchema>;
