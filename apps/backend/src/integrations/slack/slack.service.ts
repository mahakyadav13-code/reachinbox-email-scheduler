import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  team?: {
    id: string;
    name: string;
  };
  incoming_webhook?: {
    url: string;
    channel: string;
  };
  error?: string;
}

interface RateLimitNotificationData {
  senderEmail: string;
  hourlyLimit: number;
  currentWindow: string;
  currentCount: number;
  nextWindowAt?: Date;
}

class SlackService {
  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<SlackOAuthResponse> {
    try {
      const response = await axios.post<SlackOAuthResponse>(
        'https://slack.com/api/oauth.v2.access',
        null,
        {
          params: {
            client_id: config.slack.clientId,
            client_secret: config.slack.clientSecret,
            code,
            redirect_uri: config.slack.redirectUri,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Slack OAuth exchange failed:', error);
      throw new Error('Failed to exchange Slack OAuth code');
    }
  }

  /**
   * Save Slack connection for a user
   */
  async saveConnection(
    userId: string,
    accessToken: string,
    workspaceId: string,
    teamName?: string,
    webhookUrl?: string
  ) {
    return prisma.slackConnection.upsert({
      where: { userId },
      update: {
        accessToken,
        workspaceId,
        teamName,
        webhookUrl,
      },
      create: {
        userId,
        accessToken,
        workspaceId,
        teamName,
        webhookUrl,
      },
    });
  }

  /**
   * Get Slack connection for a user
   */
  async getConnection(userId: string) {
    return prisma.slackConnection.findUnique({
      where: { userId },
    });
  }

  /**
   * Delete Slack connection for a user
   */
  async deleteConnection(userId: string) {
    try {
      await prisma.slackConnection.delete({
        where: { userId },
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete Slack connection:', error);
      return false;
    }
  }

  /**
   * Send rate limit notification to Slack
   */
  async sendRateLimitNotification(
    userId: string,
    data: RateLimitNotificationData
  ): Promise<boolean> {
    try {
      const connection = await this.getConnection(userId);

      if (!connection) {
        logger.debug('No Slack connection found for user, skipping notification');
        return false;
      }

      const message = this.formatRateLimitMessage(data);

      // Use webhook if available, otherwise use chat.postMessage
      if (connection.webhookUrl) {
        await this.sendWebhookMessage(connection.webhookUrl, message);
      } else {
        await this.sendChatMessage(connection.accessToken, message);
      }

      logger.info(`Slack notification sent for rate limit: ${data.senderEmail}`);
      return true;
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      return false;
    }
  }

  /**
   * Send message via incoming webhook
   */
  private async sendWebhookMessage(webhookUrl: string, text: string) {
    await axios.post(webhookUrl, {
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text,
          },
        },
      ],
    });
  }

  /**
   * Send message via chat.postMessage API
   */
  private async sendChatMessage(accessToken: string, text: string) {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: '#general', // Default channel, could be configurable
        text,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text,
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Format rate limit notification message
   */
  private formatRateLimitMessage(data: RateLimitNotificationData): string {
    const resumesAt = data.nextWindowAt
      ? `\n*Resumes At:* ${data.nextWindowAt.toISOString()}`
      : '';

    return `⚠️ *Hourly Rate Limit Reached*

*Sender:* ${data.senderEmail}
*Hourly Limit:* ${data.hourlyLimit}
*Current Window:* ${data.currentWindow}
*Emails Sent:* ${data.currentCount}${resumesAt}

Remaining queued emails are being rescheduled into the next available window in their original order. Nothing has been dropped.`;
  }

  /**
   * Test Slack connection
   */
  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://slack.com/api/auth.test',
        null,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.ok;
    } catch (error) {
      logger.error('Slack connection test failed:', error);
      return false;
    }
  }
}

export const slackService = new SlackService();
