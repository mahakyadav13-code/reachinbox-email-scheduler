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

class SMTPService {
  private transporter: Transporter | null = null;

  async initialize() {
    if (this.transporter) return;

    try {
      this.transporter = nodemailer.createTransport({
        host: config.ethereal.host,
        port: config.ethereal.port,
        // port 465 uses implicit TLS; anything else uses STARTTLS
        secure: config.ethereal.port === 465,
        auth: {
          user: config.ethereal.user,
          pass: config.ethereal.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // Verify connection
      await this.transporter.verify();
      logger.info('SMTP connection verified');
    } catch (error) {
      logger.error('SMTP initialization failed:', error);
      throw error;
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.transporter) {
      await this.initialize();
    }

    try {
      const from = process.env.SMTP_FROM_OVERRIDE || params.from;

      const info = await this.transporter!.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html || params.text,
      });

      logger.info(`Email sent: ${info.messageId} to ${params.to}`);

      // Get preview URL for Ethereal
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
