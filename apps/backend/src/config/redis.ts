import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

const tlsOptions = config.redis.tls ? { tls: {} } : {};

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  ...tlsOptions,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error('Redis error:', error);
});

// Create a separate Redis connection for BullMQ
export const createRedisConnection = () => {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    ...tlsOptions,
    maxRetriesPerRequest: null,
  });
};

// NOTE: no `process.on('beforeExit')` handler here either - see the comment in
// config/database.ts. An async handler there prevents short-lived scripts from
// ever exiting. server.ts and worker.ts close this connection on SIGINT/SIGTERM.
