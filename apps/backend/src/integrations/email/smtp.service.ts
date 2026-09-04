/**
 * Email sending service.
 *
 * In production (RESEND_API_KEY set) uses Resend's REST API over HTTPS port 443
 * which is never blocked by cloud hosts. Locally falls back to Ethereal SMTP.
 */
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl?: string;
  accepted: string[];
  rejected: string[];
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_OVERRIDE = process.env.SMTP_FROM_OVERRIDE || 'onboarding@resend.dev';

class SMTPService {
  private transporter: Transporter | null = null;

  async initialize() {
    if (this.transporter) return;

    // Local fallback only — Resend REST path does not use nodemailer.
    if (!RESEND_API_KEY) {
      try {
        this.transporter = nodemailer.createTransport({
          host: config.ethereal.host,
          port: config.ethereal.port,
          secure: config.ethereal.port === 465,
          auth: {
            user: config.ethereal.user,
            pass: config.ethereal.pass,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

        await this.transporter.verify();
        logger.info('Email transport: Ethereal SMTP verified');
      } catch (error) {
        logger.error('SMTP initialization failed:', error);
        throw error;
      }
    } else {
      logger.info('Email transport: Resend REST API (HTTPS port 443)');
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    // Resend REST API — pure HTTPS, no SMTP socket needed.
    if (RESEND_API_KEY) {
      const from = FROM_OVERRIDE;
      const body = JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html || params.text,
      });

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const err = await response.text();
        logger.error(`Resend API error ${response.status}: ${err}`);
        throw new Error(`Resend API error ${response.status}: ${err}`);
      }

      const data = await response.json() as { id: string };
      const messageId = data.id;
      logger.info(`Email sent via Resend: ${messageId} to ${params.to}`);

      return {
        messageId,
        previewUrl: `https://resend.com/emails/${messageId}`,
        accepted: [params.to],
        rejected: [],
      };
    }

    // Local Ethereal fallback.
    if (!this.transporter) {
      await this.initialize();
    }

    try {
      const info = await this.transporter!.sendMail({
        from: params.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html || params.text,
      });

      logger.info(`Email sent via Ethereal: ${info.messageId} to ${params.to}`);
      const previewUrl = nodemailer.getTestMessageUrl(info);

      return {
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
        accepted: info.accepted as string[],
        rejected: info.rejected as string[],
      };
    } catch (error: any) {
      logger.error('Failed to send email:', error);
      throw new Error(`SMTP Error: ${error.message}`);
    }
  }

  async close() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      logger.info('SMTP connection closed');
    }
  }
}

export const smtpService = new SMTPService();
