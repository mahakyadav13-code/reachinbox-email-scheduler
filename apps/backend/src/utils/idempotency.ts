import crypto from 'crypto';

/**
 * Generate a deterministic idempotency key for an email job
 * This ensures the same campaign + recipient + scheduled time = same key
 */
export function generateIdempotencyKey(
  campaignId: string,
  recipientEmail: string,
  scheduledAt: Date
): string {
  const data = `${campaignId}:${recipientEmail}:${scheduledAt.toISOString()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a deterministic BullMQ job ID
 */
export function generateBullJobId(idempotencyKey: string): string {
  return `email-job-${idempotencyKey}`;
}

/**
 * Deterministic job ID for a job being moved into a later send window.
 *
 * Keyed on the idempotency key plus the target timestamp so that re-processing
 * the same rate-limit rejection reuses the same BullMQ id. BullMQ ignores an add
 * for an id that already exists, which is what prevents a rejected email from
 * fanning out into multiple queued copies.
 */
export function rescheduleJobId(idempotencyKey: string, targetTime: Date): string {
  return `email-job-${idempotencyKey}-w${targetTime.getTime()}`;
}
