import { User, Sender, EmailCampaign, EmailJob, SlackConnection } from '@prisma/client';

// Re-export Prisma types
export { User, Sender, EmailCampaign, EmailJob, SlackConnection };

// Express session extension
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    passport?: {
      user?: string;
    };
  }
}

// Passport user extension
declare global {
  namespace Express {
    interface User {
      id: string;
      googleId: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    }
  }
}

// Email job statuses
export enum EmailJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  DELAYED = 'delayed',
}

// Campaign statuses
export enum CampaignStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
}

// API response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Email parsing result
export interface ParsedEmailResult {
  validEmails: string[];
  invalidEmails: string[];
  duplicates: string[];
  totalRows: number;
}

// BullMQ job data
export interface EmailJobData {
  emailJobId: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  idempotencyKey: string;
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourWindow: string;
  nextAvailableTime?: Date;
}
