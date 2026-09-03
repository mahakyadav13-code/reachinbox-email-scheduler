import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, generateBullJobId, rescheduleJobId } from '../idempotency';

describe('idempotency', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const campaignId = 'campaign-123';
      const email = 'test@example.com';
      const scheduledAt = new Date('2026-09-03T10:00:00Z');

      const key1 = generateIdempotencyKey(campaignId, email, scheduledAt);
      const key2 = generateIdempotencyKey(campaignId, email, scheduledAt);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const campaignId = 'campaign-123';
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';
      const scheduledAt = new Date('2026-09-03T10:00:00Z');

      const key1 = generateIdempotencyKey(campaignId, email1, scheduledAt);
      const key2 = generateIdempotencyKey(campaignId, email2, scheduledAt);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different times', () => {
      const campaignId = 'campaign-123';
      const email = 'test@example.com';
      const time1 = new Date('2026-09-03T10:00:00Z');
      const time2 = new Date('2026-09-03T10:00:01Z');

      const key1 = generateIdempotencyKey(campaignId, email, time1);
      const key2 = generateIdempotencyKey(campaignId, email, time2);

      expect(key1).not.toBe(key2);
    });

    it('should generate 64-character hex string', () => {
      const key = generateIdempotencyKey('campaign', 'test@example.com', new Date());

      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(key).toHaveLength(64);
    });
  });

  describe('generateBullJobId', () => {
    it('should generate job ID with prefix', () => {
      const idempotencyKey = 'abc123';
      const jobId = generateBullJobId(idempotencyKey);

      expect(jobId).toBe('email-job-abc123');
    });

    it('should be consistent for same key', () => {
      const idempotencyKey = 'test-key';
      const jobId1 = generateBullJobId(idempotencyKey);
      const jobId2 = generateBullJobId(idempotencyKey);

      expect(jobId1).toBe(jobId2);
    });
  });

  describe('rescheduleJobId', () => {
    it('should be deterministic for the same key and target window', () => {
      const key = 'abc123';
      const target = new Date('2026-09-03T11:00:00Z');

      // This is what stops a rate-limited email being queued twice: replaying
      // the same rejection must produce the same BullMQ job id.
      expect(rescheduleJobId(key, target)).toBe(rescheduleJobId(key, target));
    });

    it('should differ per target window so successive rollovers do not collide', () => {
      const key = 'abc123';
      const hour11 = new Date('2026-09-03T11:00:00Z');
      const hour12 = new Date('2026-09-03T12:00:00Z');

      expect(rescheduleJobId(key, hour11)).not.toBe(rescheduleJobId(key, hour12));
    });

    it('should differ per recipient within the same window', () => {
      const target = new Date('2026-09-03T11:00:00Z');

      expect(rescheduleJobId('key-a', target)).not.toBe(rescheduleJobId('key-b', target));
    });

    it('should not collide with the original job id', () => {
      const key = 'abc123';
      const target = new Date('2026-09-03T11:00:00Z');

      expect(rescheduleJobId(key, target)).not.toBe(generateBullJobId(key));
    });
  });
});
