import { api } from '../lib/axios';
import {
  ApiResponse,
  Campaign,
  DashboardStats,
  EmailJob,
  QueueStats,
  Sender,
  SlackConnection,
  User,
} from '../types';

/** Shape returned by POST /api/campaigns. */
export interface CreateCampaignResult {
  campaign: Campaign;
  stats: {
    totalScheduled: number;
    validEmails: number;
    invalidEmails: number;
    duplicatesRemoved: number;
  };
}

export interface CreateCampaignPayload {
  subject: string;
  body: string;
  senderId: string;
  recipients: string;
  fileType: 'csv' | 'txt';
  /** ISO 8601 timestamp. */
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export const authApi = {
  getMe: () => api.get<ApiResponse<{ user: User }>>('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

export const campaignApi = {
  create: (data: CreateCampaignPayload) =>
    api.post<ApiResponse<CreateCampaignResult>>('/api/campaigns', data),

  list: (page = 1, limit = 20) =>
    api.get<ApiResponse<Campaign[]>>('/api/campaigns', { params: { page, limit } }),

  getById: (id: string) => api.get<ApiResponse<unknown>>(`/api/campaigns/${id}`),
};

export const senderApi = {
  list: () => api.get<ApiResponse<Sender[]>>('/api/senders'),
  create: (data: { name: string; email: string }) =>
    api.post<ApiResponse<Sender>>('/api/senders', data),
  delete: (id: string) => api.delete(`/api/senders/${id}`),
};

export const emailApi = {
  /** pending | processing | delayed. Pass `status` to narrow to one of them. */
  scheduled: (page = 1, limit = 25, status?: string) =>
    api.get<ApiResponse<EmailJob[]>>('/api/emails/scheduled', {
      params: { page, limit, ...(status ? { status } : {}) },
    }),

  /** sent | failed */
  sent: (page = 1, limit = 25) =>
    api.get<ApiResponse<EmailJob[]>>('/api/emails/sent', { params: { page, limit } }),

  /** Full-text search across every mailbox (Elasticsearch, SQL fallback). */
  search: (query: string, page = 1, limit = 25) =>
    api.get<ApiResponse<EmailJob[]>>('/api/emails/search', {
      params: { q: query, page, limit },
    }),

  stats: () => api.get<ApiResponse<DashboardStats>>('/api/emails/stats'),

  queueStats: () => api.get<ApiResponse<QueueStats>>('/api/emails/queue-stats'),
};

export const slackApi = {
  status: () => api.get<ApiResponse<SlackConnection>>('/api/slack/status'),
  disconnect: () => api.delete('/api/slack/disconnect'),
};
