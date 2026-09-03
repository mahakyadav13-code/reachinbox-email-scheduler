import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// SQL logging is opt-in via LOG_SQL=true rather than tied to NODE_ENV.
// Every query on every request otherwise drowns out the logs that matter during
// development - queue activity, send confirmations and Ethereal preview URLs.
if (process.env.LOG_SQL === 'true') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug(`SQL (${e.duration}ms): ${e.query}`);
  });
}

// NOTE: deliberately no `process.on('beforeExit')` disconnect here.
//
// An async `beforeExit` handler schedules new event-loop work, which causes
// `beforeExit` to fire again - short-lived scripts (like the seed) then never
// terminate. Shutdown is handled explicitly by the SIGINT/SIGTERM handlers in
// server.ts and worker.ts, and by scripts disconnecting in their own `finally`.
