import { Request, Response } from 'express';
import { config } from '../config';
import { slackService } from '../integrations/slack/slack.service';
import { logger } from '../config/logger';

export class SlackController {
  /**
   * Redirect to Slack OAuth authorization
   */
  async connect(req: Request, res: Response) {
    const scopes = [
      'chat:write',
      'incoming-webhook',
    ].join(',');

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(config.slack.redirectUri)}`;

    res.redirect(authUrl);
  }

  /**
   * Handle Slack OAuth callback
   */
  async callback(req: Request, res: Response) {
    const { code, error } = req.query;

    if (error) {
      logger.error('Slack OAuth error:', error);
      return res.redirect(`${config.urls.frontend}/dashboard?slack_error=${error}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.urls.frontend}/dashboard?slack_error=no_code`);
    }

    try {
      const userId = req.user!.id;

      // Exchange code for access token
      const oauthResponse = await slackService.exchangeCodeForToken(code);

      if (!oauthResponse.ok || !oauthResponse.access_token) {
        logger.error('Slack OAuth failed:', oauthResponse.error);
        return res.redirect(`${config.urls.frontend}/dashboard?slack_error=${oauthResponse.error}`);
      }

      // Save connection
      await slackService.saveConnection(
        userId,
        oauthResponse.access_token,
        oauthResponse.team?.id || 'unknown',
        oauthResponse.team?.name,
        oauthResponse.incoming_webhook?.url
      );

      logger.info(`Slack connected for user ${userId}`);

      res.redirect(`${config.urls.frontend}/dashboard?slack_connected=true`);
    } catch (error) {
      logger.error('Slack callback error:', error);
      res.redirect(`${config.urls.frontend}/dashboard?slack_error=unknown`);
    }
  }

  /**
   * Disconnect Slack integration
   */
  async disconnect(req: Request, res: Response) {
    const userId = req.user!.id;

    const success = await slackService.deleteConnection(userId);

    if (success) {
      res.json({ message: 'Slack disconnected successfully' });
    } else {
      res.status(500).json({ error: 'Failed to disconnect Slack' });
    }
  }

  /**
   * Get Slack connection status
   */
  async getStatus(req: Request, res: Response) {
    const userId = req.user!.id;

    const connection = await slackService.getConnection(userId);

    // Wrapped in `data` for consistency with the rest of the API.
    res.json({
      data: {
        connected: !!connection,
        workspace: connection?.teamName || null,
        connectedAt: connection?.connectedAt || null,
      },
    });
  }
}

export const slackController = new SlackController();
