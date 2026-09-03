export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sender {
  id: string;
  userId: string;
  name: string;
  email: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  totalEmails: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
  _count?: {
    emailJobs: number;
  };
}

export interface EmailJob {
  id: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'delayed';
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
  campaign?: {
    id: string;
    subject: string;
  };
}

export interface DashboardStats {
  totalScheduled: number;
  sentToday: number;
  failed: number;
  queueWaiting: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

export interface SlackConnection {
  connected: boolean;
  workspace: string | null;
  connectedAt: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
  message?: string;
  error?: string;
  /** Which backend served a search request: Elasticsearch, or the SQL fallback. */
  searchEngine?: 'elasticsearch' | 'sql';
}
