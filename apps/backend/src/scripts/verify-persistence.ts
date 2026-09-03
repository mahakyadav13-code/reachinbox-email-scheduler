/**
 * Snapshot of everything that must survive a restart.
 *
 * Run it, restart the API and worker, then run it again: the delayed job IDs and
 * their send times must be identical, and no job may have been re-sent.
 *
 * Usage: npx tsx src/scripts/verify-persistence.ts
 */
import signature from 'cookie-signature';
import Redis from 'ioredis';
import { config } from '../config';
import { prisma } from '../config/database';
import { emailQueue, getQueueStats } from '../queues/email.queue';

/**
 * Builds a signed cookie for a session belonging to the owner of the most recent
 * campaign. Picking an arbitrary session would search as the wrong tenant and
 * legitimately return nothing.
 */
async function apiCookie(
  redis: Redis,
  preferredUserId?: string
): Promise<{ cookie: string; userId: string } | null> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  const sessions: Array<{ sid: string; userId: string }> = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    const userId = raw ? JSON.parse(raw)?.passport?.user : null;
    if (userId) sessions.push({ sid: key.replace('sess:', ''), userId });
  }

  const chosen =
    sessions.find((s) => s.userId === preferredUserId) ?? sessions[0] ?? null;
  if (!chosen) return null;

  const signed = `s:${signature.sign(chosen.sid, config.auth.sessionSecret)}`;
  return {
    cookie: `connect.sid=${encodeURIComponent(signed)}`,
    userId: chosen.userId,
  };
}

async function main() {
  const redis = new Redis({ host: config.redis.host, port: config.redis.port });

  console.log('='.repeat(74));
  console.log(`PERSISTENCE SNAPSHOT  ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(74));

  // --- BullMQ delayed set -------------------------------------------------
  const stats = await getQueueStats();
  console.log(`\nqueue counters : ${JSON.stringify(stats)}`);

  const delayedJobs = await emailQueue.getDelayed(0, 50);
  console.log(`\ndelayed jobs in Redis (${delayedJobs.length}):`);
  for (const job of delayedJobs) {
    const dueAt = new Date((job.timestamp ?? 0) + (job.delay ?? 0));
    console.log(
      `  ${String(job.data?.recipientEmail).padEnd(26)} due ${dueAt.toISOString()}  id=${String(
        job.id
      ).slice(-18)}`
    );
  }

  // --- Database state -----------------------------------------------------
  const grouped = await prisma.emailJob.groupBy({
    by: ['status'],
    _count: { status: true },
  });
  console.log(`\ndatabase statuses : ${grouped.map((g) => `${g.status}=${g._count.status}`).join('  ')}`);

  // Duplicate detection: an idempotency key must never appear twice, and no
  // recipient may have more than one `sent` row per campaign.
  const duplicateSends = await prisma.$queryRaw<Array<{ campaignid: string; recipientemail: string; n: bigint }>>`
    SELECT "campaignId" AS campaignid, "recipientEmail" AS recipientemail, COUNT(*) AS n
    FROM email_jobs
    WHERE status = 'sent'
    GROUP BY "campaignId", "recipientEmail"
    HAVING COUNT(*) > 1
  `;
  console.log(`duplicate sends   : ${duplicateSends.length === 0 ? 'none' : JSON.stringify(duplicateSends)}`);

  // --- Search path --------------------------------------------------------
  // Search is scoped per user, so authenticate as the owner of the latest
  // campaign rather than whichever session happens to come first.
  const latestCampaign = await prisma.emailCampaign.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, email: true } } },
  });

  const session = await apiCookie(redis, latestCampaign?.userId);

  if (session) {
    const asUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });

    const response = await fetch(`${config.urls.backend}/api/emails/search?q=smoke&limit=5`, {
      headers: { cookie: session.cookie },
    });
    const body: any = await response.json();

    console.log(`\nsearching as      : ${asUser?.email ?? session.userId}`);
    console.log(`campaign owner    : ${latestCampaign?.user.email ?? 'n/a'}`);
    console.log(
      `search "smoke"    : ${response.status} · ${body?.data?.length ?? 0} hits · engine=${
        body?.searchEngine ?? 'n/a'
      } · total=${body?.pagination?.total ?? 0}`
    );
  }

  await redis.quit();
  await emailQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('snapshot failed:', error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
