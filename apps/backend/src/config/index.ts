import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  },
  
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  },
  
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!,
  },
  
  auth: {
    sessionSecret: process.env.SESSION_SECRET!,
    jwtSecret: process.env.JWT_SECRET!,
    // Optional shared token for opening the Bull Board dashboard without an
    // interactive login. Leave unset to require a signed-in session.
    dashboardToken: process.env.QUEUE_DASHBOARD_TOKEN || '',
  },
  
  ethereal: {
    host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.ETHEREAL_PORT || '587', 10),
    user: process.env.ETHEREAL_USER!,
    pass: process.env.ETHEREAL_PASS!,
  },
  
  slack: {
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    redirectUri: process.env.SLACK_REDIRECT_URI!,
  },
  
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  },
  
  rateLimit: {
    maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '200', 10),
  },
  
  scheduling: {
    minDelayBetweenEmailsSeconds: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_SECONDS || '2', 10),
  },
  
  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:5173',
    backend: process.env.BACKEND_URL || 'http://localhost:5000',
  },
};
