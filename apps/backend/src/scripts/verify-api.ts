/**
 * End-to-end response-shape check.
 *
 * Reuses a live browser session from Redis and calls the endpoints the SPA
 * depends on, asserting that each one returns the `{ data: ... }` envelope the
 * client reads. A mismatch here is invisible in the browser - the request
 * succeeds with 200 and the UI silently behaves as if it got nothing.
 *
 * Run with: npx tsx src/scripts/verify-api.ts
 */
import signature from 'cookie-signature';
import Redis from 'ioredis';
import { config } from '../config';

const API = config.urls.backend;

interface Check {
  path: string;
  /** Reads the value the frontend actually depends on. */
  extract: (body: any) => unknown;
  describe: string;
}

const CHECKS: Check[] = [
  { path: '/api/auth/me', extract: (b) => b?.data?.user?.email, describe: 'data.user.email' },
  { path: '/api/emails/stats', extract: (b) => b?.data?.totalScheduled, describe: 'data.totalScheduled' },
  { path: '/api/emails/queue-stats', extract: (b) => b?.data?.delayed, describe: 'data.delayed' },
  { path: '/api/senders', extract: (b) => b?.data?.length, describe: 'data.length' },
  { path: '/api/campaigns', extract: (b) => b?.data?.length, describe: 'data.length' },
  { path: '/api/emails/scheduled', extract: (b) => b?.data?.length, describe: 'data.length' },
  { path: '/api/emails/sent', extract: (b) => b?.data?.length, describe: 'data.length' },
  { path: '/api/slack/status', extract: (b) => b?.data?.connected, describe: 'data.connected' },
];

async function main() {
  const redis = new Redis({ host: config.redis.host, port: config.redis.port });

  // Find a session that belongs to a logged-in user.
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  let sid: string | null = null;
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw && JSON.parse(raw)?.passport?.user) {
      sid = key.replace('sess:', '');
      break;
    }
  }

  if (!sid) {
    console.error('No authenticated session found in Redis. Sign in through the app first.');
    await redis.quit();
    process.exit(1);
  }

  const cookie = `connect.sid=${encodeURIComponent(
    `s:${signature.sign(sid, config.auth.sessionSecret)}`
  )}`;

  console.log(`Using session ${sid.slice(0, 8)}…\n`);

  let failures = 0;

  for (const check of CHECKS) {
    const response = await fetch(`${API}${check.path}`, { headers: { cookie } });
    const text = await response.text();

    let value: unknown;
    let parsed: any;
    try {
      parsed = JSON.parse(text);
      value = check.extract(parsed);
    } catch {
      value = undefined;
    }

    const ok = response.status === 200 && value !== undefined;
    if (!ok) failures += 1;

    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${check.path.padEnd(28)} ${String(response.status).padEnd(4)} ${check.describe} = ${JSON.stringify(value)}`
    );

    if (!ok) console.log(`      body: ${text.slice(0, 160)}`);
  }

  await redis.quit();

  console.log(`\n${CHECKS.length - failures}/${CHECKS.length} endpoints return the expected shape.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('verification failed:', error);
  process.exit(1);
});
