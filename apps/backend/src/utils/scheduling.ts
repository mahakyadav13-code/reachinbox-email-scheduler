/**
 * Calculate scheduled send times for a batch of emails
 * Each email gets startTime + (index * delay)
 */
export function calculateScheduledTimes(
  startTime: Date,
  count: number,
  delayBetweenEmailsSeconds: number
): Date[] {
  const scheduledTimes: Date[] = [];
  
  for (let i = 0; i < count; i++) {
    const delayMs = i * delayBetweenEmailsSeconds * 1000;
    const scheduledAt = new Date(startTime.getTime() + delayMs);
    scheduledTimes.push(scheduledAt);
  }
  
  return scheduledTimes;
}

/**
 * Calculate delay in milliseconds from now until the scheduled time
 * Returns 0 if scheduled time is in the past
 */
export function calculateDelay(scheduledAt: Date): number {
  const now = new Date();
  const delay = scheduledAt.getTime() - now.getTime();
  return Math.max(0, delay);
}

/**
 * Get the start of the current hour window (e.g., 2026-09-03 10:00:00)
 */
export function getCurrentHourWindow(): Date {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now;
}

/**
 * Format hour window as string for Redis key
 */
export function formatHourWindow(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Calculate the next available hour window
 */
export function getNextHourWindow(currentWindow: Date): Date {
  const next = new Date(currentWindow);
  next.setHours(next.getHours() + 1);
  return next;
}
