import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import RedisStore from 'connect-redis';
import { config } from './config';
import { logger } from './config/logger';
import { redis } from './config/redis';

const app = express();

const isProduction = config.nodeEnv === 'production';

// Railway (and any managed host) terminates TLS at a proxy and forwards plain
// HTTP internally. Without this, Express sees an insecure connection and
// express-session silently refuses to set a `Secure` cookie, so login never
// sticks in production.
if (isProduction) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: config.urls.frontend,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(
  session({
    store: new RedisStore({ client: redis as any }),
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    // Trust the proxy's X-Forwarded-Proto when deciding whether the connection
    // counts as secure, so the `Secure` cookie below is actually issued.
    proxy: isProduction,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      // In production the SPA and the API are on different sites (onrender.com
      // vs railway.app), so the session cookie has to be SameSite=None or the
      // browser withholds it on cross-site XHR and every request looks logged
      // out. SameSite=None is only honoured alongside Secure. Locally both apps
      // are on localhost, where Lax works and Secure would break plain HTTP.
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Request tracing for the auth flow.
//
// Enabled with LOG_REQUESTS=true. Logs whether the browser sent a session
// cookie and whether the response set one, which is what distinguishes a
// server-side session problem from a browser cookie problem.
if (process.env.LOG_REQUESTS === 'true') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const hadCookie = Boolean(req.headers.cookie?.includes('connect.sid'));

    res.on('finish', () => {
      const setCookie = res.getHeader('set-cookie');
      const parts = [
        `${req.method} ${req.originalUrl.split('?')[0]}`,
        `-> ${res.statusCode}`,
        `cookieIn=${hadCookie ? 'yes' : 'no'}`,
        `cookieOut=${setCookie ? 'yes' : 'no'}`,
        `authed=${req.isAuthenticated?.() ? 'yes' : 'no'}`,
        `sid=${req.sessionID ? req.sessionID.slice(0, 8) : 'none'}`,
      ];

      if (req.headers.origin) parts.push(`origin=${req.headers.origin}`);
      logger.info(`[trace] ${parts.join(' ')}`);
    });

    next();
  });
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import senderRoutes from './routes/sender.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import { bullBoardRouter } from './config/bull-board';
import { requireQueueDashboardAuth } from './middleware/auth.middleware';

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Bull Board queue dashboard.
//
// Guarded by the same session auth as the API: the board can retry, promote and
// delete jobs, so it must not be publicly reachable. Sign in through the app
// first, then open this URL in the same browser.
app.use('/admin/queues', requireQueueDashboardAuth, bullBoardRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Expected client errors (a 401 from the session probe, a 400 from validation)
  // are part of normal operation - log them as one-line warnings. Only genuine
  // server faults get the full stack trace.
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  }

  res.status(statusCode).json({
    error: message,
    ...(config.nodeEnv === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
});

export default app;
