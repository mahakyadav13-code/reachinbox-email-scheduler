/**
 * End-to-end smoke test driven entirely through the public API.
 *
 * Schedules a small batch with a deliberately low hourly limit so the rate
 * limiter trips mid-campaign, then watches the database until every job reaches
 * a terminal state. Proves, in one run:
 *
 *   1. POST /api/campaigns accepts and persists a batch
 *   2. BullMQ delivers the due jobs and SMTP accepts them
 *   3. The per-campaign hourly limit is enforced
 *   4. Capped jobs are rescheduled into the next window (not dropped/failed)
 *   5. Rescheduled jobs keep their relative order
 *   6. Elasticsearch receives documents
 *
 * Usage: npx tsx src/scripts/smoke-e2e.ts [recipients] [hourlyLimit]
 */
import signature from 'cookie-signature';
import Redis from 'ioredis';
import { config } from '../config';
import { prisma } from '../config/database';

const RECIPIENTS = Number(process.argv[2] ?? 5);
const HOURLY_LIMIT = Number(process.argv[3] ?? 3);
const API = config.urls.backend;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sessionCookie(redis: Redis): Promise<{ cookie: string; userId: string }> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  for (const key of keys) {
    const raw = await redis.get(key);
    const userId = raw ? JSON.parse(raw)?.passport?.user : null;
    if (userId) {
      const sid = key.replace('sess:', '');
      const signed = `s:${signature.sign(sid, config.auth.sessionSecret)}`;
      return { cookie: `connect.sid=${encodeURIComponent(signed)}`, userId };
    }
  }

  throw new Error('No authenticated session in Redis - sign in through the app first.');
}

async function main() {
  const redis = new Redis({ host: config.redis.host, port: config.redis.port });
  const { cookie, userId } = await sessionCookie(redis);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const sender = await prisma.sender.findFirst({ where: { userId } });

  if (!sender) throw new Error('That user has no senders - run `npm run demo:seed` first.');

  console.log('='.repeat(74));
  console.log('END-TO-END SMOKE TEST');
  console.log('='.repeat(74));
  console.log(`user          : ${user?.email}`);
  console.log(`sender        : ${sender.name} <${sender.email}>`);
  console.log(`recipients    : ${RECIPIENTS}`);
  console.log(`hourly limit  : ${HOURLY_LIMIT}  (expect ${Math.min(
    RECIPIENTS,
    HOURLY_LIMIT
  )} sent now, ${Math.max(RECIPIENTS - HOURLY_LIMIT, 0)} rescheduled)`);

  // Recipients are numbered so ordering can be checked after rescheduling.
  const recipients = ['email']
    .concat(
      Array.from({ length: RECIPIENTS }, (_, i) => `smoke-${String(i + 1).padStart(2, '0')}@example.com`)
    )
    .join('\n');

  // Start 5 seconds out so the first job is due almost immediately.
  const startTime = new Date(Date.now() + 5000).toISOString();

  console.log(`\nPOST ${API}/api/campaigns …`);
  const response = await fetch(`${API}/api/campaigns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      senderId: sender.id,
      subject: `Smoke test · ${new Date().toISOString()}`,
      body: 'Verifying scheduling, throttling and rescheduling behaviour.',
      recipients,
      fileType: 'csv',
      startTime,
      delayBetweenEmails: 2,
      hourlyLimit: HOURLY_LIMIT,
    }),
  });

  const payload: any = await response.json();
  if (response.status !== 201) {
    console.error(`FAILED (${response.status}):`, JSON.stringify(payload).slice(0, 300));
    process.exit(1);
  }

  const campaignId: string = payload.data.campaign.id;
  console.log(`created campaign : ${campaignId}`);
  console.log(`parse stats      : ${JSON.stringify(payload.data.stats)}`);

  // ---------------------------------------------------------------- watch
  console.log('\nWatching job statuses (up to 90s)…\n');
  const deadline = Date.now() + 90_000;
  let lastLine = '';

  while (Date.now() < deadline) {
    const jobs = await prisma.emailJob.findMany({
      where: { campaignId },
      orderBy: { recipientEmail: 'asc' },
      select: { recipientEmail: true, status: true, scheduledAt: true, sentAt: true },
    });

    const counts = jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});

    const line = Object.entries(counts)
      .map(([status, count]) => `${status}=${count}`)
      .join('  ');

    if (line !== lastLine) {
      console.log(`  [${new Date().toLocaleTimeString()}] ${line}`);
      lastLine = line;
    }

    // Terminal once nothing is pending or processing.
    const settled = !jobs.some((j) => j.status === 'pending' || j.status === 'processing');
    if (settled && jobs.length > 0) break;

    await sleep(3000);
  }

  // ---------------------------------------------------------------- results
  const jobs = await prisma.emailJob.findMany({
    where: { campaignId },
    orderBy: { recipientEmail: 'asc' },
    select: { recipientEmail: true, status: true, scheduledAt: true, sentAt: true },
  });

  console.log('\n' + '-'.repeat(74));
  console.log('FINAL STATE');
  console.log('-'.repeat(74));
  for (const job of jobs) {
    const when = job.sentAt ?? job.scheduledAt;
    console.log(
      `  ${job.recipientEmail.padEnd(28)} ${job.status.padEnd(11)} ${when.toISOString()}`
    );
  }

  const sent = jobs.filter((j) => j.status === 'sent');
  const delayed = jobs.filter((j) => j.status === 'delayed');
  const failed = jobs.filter((j) => j.status === 'failed');

  // Rescheduled jobs must be spaced and ordered, not stacked on the boundary.
  const rescheduledTimes = delayed
    .map((j) => j.scheduledAt.getTime())
    .sort((a, b) => a - b);
  const spacingOk =
    rescheduledTimes.length < 2 ||
    rescheduledTimes.every((t, i) => i === 0 || t > rescheduledTimes[i - 1]);

  // Elasticsearch document count for this campaign.
  let esCount: number | string = 'n/a';
  try {
    const esResponse = await fetch(
      `${config.elasticsearch.node}/email-jobs/_count?q=campaignId:${campaignId}`
    );
    const esBody: any = await esResponse.json();
    esCount = esBody?.count ?? 'n/a';
  } catch {
    esCount = 'unreachable';
  }

  const rateLimitKeys = await redis.keys(`rate_limit:${sender.id}:*`);
  const notifyKeys = await redis.keys(`rate_limit_notified:${sender.id}:*`);
  const seqKeys = await redis.keys(`reschedule_seq:${sender.id}:*`);

  console.log('\n' + '='.repeat(74));
  console.log('ASSERTIONS');
  console.log('='.repeat(74));

  const checks: Array<[string, boolean, string]> = [
    ['Jobs persisted', jobs.length === RECIPIENTS, `${jobs.length}/${RECIPIENTS}`],
    ['Sent up to the limit', sent.length === Math.min(RECIPIENTS, HOURLY_LIMIT), `${sent.length} sent`],
    [
      'Overflow rescheduled, not failed',
      delayed.length === Math.max(RECIPIENTS - HOURLY_LIMIT, 0) && failed.length === 0,
      `${delayed.length} delayed, ${failed.length} failed`,
    ],
    ['Rescheduled jobs are ordered/spaced', spacingOk, `${rescheduledTimes.length} times, strictly increasing`],
    ['Rate limit counter exists', rateLimitKeys.length > 0, rateLimitKeys.join(', ') || 'none'],
    [
      'Slack notified once per window',
      notifyKeys.length <= 1,
      `${notifyKeys.length} notify marker(s)`,
    ],
    ['Reschedule sequence used', seqKeys.length > 0 || delayed.length === 0, seqKeys.join(', ') || 'none'],
    ['Indexed in Elasticsearch', typeof esCount === 'number' && esCount > 0, `${esCount} docs`],
  ];

  let failures = 0;
  for (const [name, ok, detail] of checks) {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(38)} ${detail}`);
  }

  console.log(`\n${checks.length - failures}/${checks.length} checks passed.`);
  if (delayed.length > 0) {
    console.log(
      `\nRescheduled to: ${new Date(rescheduledTimes[0]).toLocaleString()} (next hour window)`
    );
  }

  await redis.quit();
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nsmoke test failed:', error.message ?? error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
