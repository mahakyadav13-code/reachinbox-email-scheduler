import app from './app';
import { config } from './config';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { elasticsearchService } from './integrations/elasticsearch/elasticsearch.service';

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');
    
    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected');

    // Initialize Elasticsearch (non-blocking)
    elasticsearchService.initialize().catch((error) => {
      logger.warn('Elasticsearch initialization failed, will use SQL fallback:', error);
    });
    
    // Start server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Bull Board: ${config.urls.backend}/admin/queues`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.quit();
  await elasticsearchService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.quit();
  await elasticsearchService.close();
  process.exit(0);
});

startServer();
