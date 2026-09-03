import { describe, it, expect } from 'vitest';
import {
  calculateScheduledTimes,
  calculateDelay,
  formatHourWindow,
  getCurrentHourWindow,
  getNextHourWindow,
} from '../scheduling';

describe('scheduling', () => {
  describe('calculateScheduledTimes', () => {
    it('should calculate correct scheduled times with delay', () => {
      const startTime = new Date('2026-09-03T10:00:00Z');
      const count = 3;
      const delaySeconds = 2;

      const times = calculateScheduledTimes(startTime, count, delaySeconds);

      expect(times).toHaveLength(3);
      expect(times[0].toISOString()).toBe('2026-09-03T10:00:00.000Z');
      expect(times[1].toISOString()).toBe('2026-09-03T10:00:02.000Z');
      expect(times[2].toISOString()).toBe('2026-09-03T10:00:04.000Z');
    });

    it('should handle zero delay', () => {
      const startTime = new Date('2026-09-03T10:00:00Z');
      const count = 3;
      const delaySeconds = 0;

      const times = calculateScheduledTimes(startTime, count, delaySeconds);

      expect(times).toHaveLength(3);
      times.forEach((time) => {
        expect(time.toISOString()).toBe(startTime.toISOString());
      });
    });

    it('should scale to large counts', () => {
      const startTime = new Date('2026-09-03T10:00:00Z');
      const count = 1000;
      const delaySeconds = 1;

      const times = calculateScheduledTimes(startTime, count, delaySeconds);

      expect(times).toHaveLength(1000);
      // Last email should be 999 seconds after start
      const expectedLast = new Date(startTime.getTime() + 999 * 1000);
      expect(times[999].toISOString()).toBe(expectedLast.toISOString());
    });
  });

  describe('calculateDelay', () => {
    it('should calculate positive delay for future time', () => {
      const future = new Date(Date.now() + 5000);
      const delay = calculateDelay(future);

      expect(delay).toBeGreaterThan(4000);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should return 0 for past time', () => {
      const past = new Date(Date.now() - 5000);
      const delay = calculateDelay(past);

      expect(delay).toBe(0);
    });
  });

  describe('formatHourWindow', () => {
    it('should format date as hour window string', () => {
      const date = new Date('2026-09-03T14:30:45Z');
      const formatted = formatHourWindow(date);

      // Note: This will depend on timezone, but the format should be consistent
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe('getCurrentHourWindow', () => {
    it('should return start of current hour', () => {
      const window = getCurrentHourWindow();

      expect(window.getMinutes()).toBe(0);
      expect(window.getSeconds()).toBe(0);
      expect(window.getMilliseconds()).toBe(0);
    });
  });

  describe('getNextHourWindow', () => {
    it('should return next hour window', () => {
      const current = new Date('2026-09-03T10:00:00Z');
      const next = getNextHourWindow(current);

      expect(next.toISOString()).toBe('2026-09-03T11:00:00.000Z');
    });

    it('should handle day boundary', () => {
      const current = new Date('2026-09-03T23:00:00Z');
      const next = getNextHourWindow(current);

      expect(next.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    });
  });
});
