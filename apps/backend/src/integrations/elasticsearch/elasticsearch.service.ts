import { Client } from '@elastic/elasticsearch';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { EmailJob } from '../../types';

interface EmailDocument {
  emailJobId: string;
  campaignId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderEmail: string;
  senderName: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
  createdAt: string;
}

type IndexableEmailJob = EmailJob & {
  sender: { name: string; email: string };
  campaign: { userId: string };
};

/** How long to wait before retrying a failed connection. */
const RECONNECT_COOLDOWN_MS = 30_000;

class ElasticsearchService {
  private client: Client | null = null;
  private readonly indexName = 'email-jobs';
  private isAvailable = false;
  private lastAttemptAt = 0;

  async initialize() {
    return this.connect();
  }

  /**
   * Connect (or reconnect) to Elasticsearch.
   *
   * The API server usually boots before the Elasticsearch container finishes its
   * start-up, so a single failed attempt must not disable search for the life of
   * the process. Attempts are retried lazily behind a cooldown.
   */
  private async connect(): Promise<boolean> {
    if (this.isAvailable && this.client) return true;

    const now = Date.now();
    if (now - this.lastAttemptAt < RECONNECT_COOLDOWN_MS) return false;
    this.lastAttemptAt = now;

    try {
      this.client =
        this.client ??
        new Client({
          node: config.elasticsearch.node,
          requestTimeout: 5000,
        });

      await this.client.ping();
      await this.createIndexIfNotExists();

      this.isAvailable = true;
      logger.info('Elasticsearch connected');
      return true;
    } catch (error) {
      this.isAvailable = false;
      logger.warn(
        `Elasticsearch unavailable, search falls back to SQL (retrying in ${
          RECONNECT_COOLDOWN_MS / 1000
        }s)`
      );
      return false;
    }
  }

  /**
   * Resolve whether Elasticsearch can serve this request, retrying a dropped
   * connection if the cooldown has elapsed.
   */
  async ensureAvailable(): Promise<boolean> {
    return this.connect();
  }

  private async createIndexIfNotExists() {
    if (!this.client) return;

    const exists = await this.client.indices.exists({ index: this.indexName });
    if (exists) return;

    await this.client.indices.create({
      index: this.indexName,
      mappings: {
        properties: {
          emailJobId: { type: 'keyword' },
          campaignId: { type: 'keyword' },
          userId: { type: 'keyword' },
          // Indexed as text with a keyword sub-field so partial matches work
          // ("john" finds john@example.com) while exact filters remain possible.
          recipientEmail: {
            type: 'text',
            fields: { raw: { type: 'keyword' } },
          },
          subject: { type: 'text' },
          body: { type: 'text' },
          senderEmail: {
            type: 'text',
            fields: { raw: { type: 'keyword' } },
          },
          senderName: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          createdAt: { type: 'date' },
        },
      },
    });

    logger.info(`Elasticsearch index '${this.indexName}' created`);
  }

  private toDocument(emailJob: IndexableEmailJob): EmailDocument {
    return {
      emailJobId: emailJob.id,
      campaignId: emailJob.campaignId,
      userId: emailJob.campaign.userId,
      recipientEmail: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
      senderEmail: emailJob.sender.email,
      senderName: emailJob.sender.name,
      status: emailJob.status,
      scheduledAt: emailJob.scheduledAt.toISOString(),
      sentAt: emailJob.sentAt?.toISOString(),
      createdAt: emailJob.createdAt.toISOString(),
    };
  }

  /**
   * Index a single email job. Indexing failures are logged, never thrown, so a
   * search outage cannot fail an email send.
   */
  async indexEmailJob(emailJob: IndexableEmailJob) {
    if (!(await this.ensureAvailable()) || !this.client) {
      logger.debug('Elasticsearch not available, skipping indexing');
      return;
    }

    try {
      await this.client.index({
        index: this.indexName,
        id: emailJob.id,
        document: this.toDocument(emailJob),
      });

      logger.debug(`Indexed email job ${emailJob.id} in Elasticsearch`);
    } catch (error) {
      logger.error('Failed to index email job:', error);
    }
  }

  /**
   * Bulk-index freshly scheduled jobs so emails are searchable from the moment
   * they are queued, not only once they have been sent.
   */
  async indexEmailJobsBulk(emailJobs: IndexableEmailJob[]) {
    if (emailJobs.length === 0) return;

    if (!(await this.ensureAvailable()) || !this.client) {
      logger.debug('Elasticsearch not available, skipping bulk indexing');
      return;
    }

    try {
      const operations = emailJobs.flatMap((job) => [
        { index: { _index: this.indexName, _id: job.id } },
        this.toDocument(job),
      ]);

      const result = await this.client.bulk({ operations, refresh: false });

      if (result.errors) {
        logger.warn('Some documents failed to index in Elasticsearch');
      } else {
        logger.info(`Bulk indexed ${emailJobs.length} email jobs in Elasticsearch`);
      }
    } catch (error) {
      logger.error('Failed to bulk index email jobs:', error);
    }
  }

  /**
   * Search a user's emails. Scoped by userId term filter so one tenant can never
   * read another's mail.
   */
  async searchEmailJobs(
    userId: string,
    query: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ jobs: any[]; total: number }> {
    if (!(await this.ensureAvailable()) || !this.client) {
      throw new Error('Elasticsearch not available');
    }

    const { page = 1, limit = 50 } = options;
    const from = (page - 1) * limit;

    const result = await this.client.search({
      index: this.indexName,
      from,
      size: limit,
      query: {
        bool: {
          filter: [{ term: { userId } }],
          must: [
            {
              multi_match: {
                query,
                fields: ['recipientEmail^3', 'subject^2', 'senderEmail', 'body'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const jobs = result.hits.hits.map((hit: any) => ({
      id: hit._source?.emailJobId ?? hit._id,
      ...hit._source,
      score: hit._score,
    }));

    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value || 0;

    return { jobs, total };
  }

  /**
   * Synchronous best-effort view of connectivity, for logging and health output.
   */
  isElasticsearchAvailable(): boolean {
    return this.isAvailable && this.client !== null;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.isAvailable = false;
      logger.info('Elasticsearch connection closed');
    }
  }
}

export const elasticsearchService = new ElasticsearchService();
