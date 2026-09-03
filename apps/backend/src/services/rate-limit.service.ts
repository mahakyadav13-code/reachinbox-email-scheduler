import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../config/logger';
import { formatHourWindow, getCurrentHourWindow, getNextHourWindow } from '../utils/scheduling';
import { RateLimitResult } from '../types';

/** Counters live slightly longer than the window they describe, for debuggability. */
const WINDOW_TTL_SECONDS = 7200;

class RateLimitService {
  private readonly globalMaxEmailsPerHour: number;

  constructor() {
    this.globalMaxEmailsPerHour = config.rateLimit.maxEmailsPerHourPerSender;
  }

  /**
   * The limit actually applied to a send.
   *
   * A campaign may request a tighter hourly limit than the deployment-wide cap,
   * but never a looser one, so the effective limit is the lower of the two. This
   * is what makes the "Hourly limit" field in the compose form meaningful while
   * keeping MAX_EMAILS_PER_HOUR_PER_SENDER authoritative as a safety ceiling.
   */
  resolveLimit(campaignHourlyLimit?: number | null): number {
    if (!campaignHourlyLimit || campaignHourlyLimit <= 0) {
      return this.globalMaxEmailsPerHour;
    }
    return Math.min(campaignHourlyLimit, this.globalMaxEmailsPerHour);
  }

  /**
   * Atomically reserve one send for a sender in the current hour window.
   *
   * Uses a single Redis INCR as the reservation, then rolls the counter back if
   * the reservation exceeded the limit. This keeps the counter equal to the
   * number of sends actually permitted, and is safe across multiple worker
   * processes because INCR/DECR are atomic server-side operations (no
   * in-memory state is involved).
   */
  async checkAndIncrement(senderId: string, limit?: number): Promise<RateLimitResult> {
    const effectiveLimit = this.resolveLimit(limit);
    const currentWindow = getCurrentHourWindow();
    const windowKey = this.getRedisKey(senderId, currentWindow);
    const hourWindow = formatHourWindow(currentWindow);

    try {
      const reservation = await redis.incr(windowKey);

      // Set the TTL on first use of this window key.
      if (reservation === 1) {
        await redis.expire(windowKey, WINDOW_TTL_SECONDS);
      }

      if (reservation <= effectiveLimit) {
        return {
          allowed: true,
          currentCount: reservation,
          limit: effectiveLimit,
          hourWindow,
        };
      }

      // Over limit: release the reservation so the counter keeps reflecting real
      // sends rather than drifting upward on every blocked attempt.
      await redis.decr(windowKey);

      return {
        allowed: false,
        currentCount: effectiveLimit,
        limit: effectiveLimit,
        hourWindow,
        nextAvailableTime: getNextHourWindow(currentWindow),
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Fail open: a Redis blip should not stop mail from going out.
      return {
        allowed: true,
        currentCount: 0,
        limit: effectiveLimit,
        hourWindow,
      };
    }
  }

  /**
   * Position for a job being pushed into a future window.
   *
   * Blocked jobs are handed monotonically increasing sequence numbers, so the
   * worker can space them out inside the next window in the order they were
   * rejected instead of dumping them all on the window boundary.
   */
  async nextRescheduleSequence(senderId: string, targetWindow: Date): Promise<number> {
    const key = `reschedule_seq:${senderId}:${formatHourWindow(targetWindow)}`;

    try {
      const sequence = await redis.incr(key);
      if (sequence === 1) {
        await redis.expire(key, WINDOW_TTL_SECONDS);
      }
      return sequence;
    } catch (error) {
      logger.error('Failed to get reschedule sequence:', error);
      return 1;
    }
  }

  /**
   * Claims the right to send one "limit reached" notification per sender per
   * window. Returns true only for the first caller, so a 1000-email backlog
   * produces one Slack message instead of eight hundred.
   */
  async claimLimitNotification(senderId: string, hourWindow: string): Promise<boolean> {
    const key = `rate_limit_notified:${senderId}:${hourWindow}`;

    try {
      const result = await redis.set(key, '1', 'EX', WINDOW_TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Failed to claim rate limit notification:', error);
      return false;
    }
  }

  /**
   * Get current count for a sender in the current hour window
   */
  async getCurrentCount(senderId: string): Promise<number> {
    const currentWindow = getCurrentHourWindow();
    const windowKey = this.getRedisKey(senderId, currentWindow);

    try {
      const count = await redis.get(windowKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error('Failed to get rate limit count:', error);
      return 0;
    }
  }

  /**
   * Release a reservation that was taken but not used (e.g. the send threw
   * before reaching the SMTP call).
   */
  async decrement(senderId: string): Promise<void> {
    const currentWindow = getCurrentHourWindow();
    const windowKey = this.getRedisKey(senderId, currentWindow);

    try {
      const count = await redis.decr(windowKey);
      if (count < 0) {
        await redis.set(windowKey, '0');
      }
    } catch (error) {
      logger.error('Failed to decrement rate limit:', error);
    }
  }

  private getRedisKey(senderId: string, window: Date): string {
    return `rate_limit:${senderId}:${formatHourWindow(window)}`;
  }
}

export const rateLimitService = new RateLimitService();
