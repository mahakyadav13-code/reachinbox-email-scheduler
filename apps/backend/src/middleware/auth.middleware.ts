import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { config } from '../config';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Just pass through - user may or may not be authenticated
  next();
}

/**
 * Guards the Bull Board queue dashboard.
 *
 * The dashboard exposes destructive queue controls (retry, promote, remove), so
 * it requires a logged-in session. Because it is opened directly in a browser
 * rather than through the SPA, an unauthenticated visitor is redirected to the
 * login flow instead of receiving a JSON 401.
 *
 * Optionally, setting QUEUE_DASHBOARD_TOKEN allows non-interactive access via
 * `?token=...` for environments where signing in is impractical.
 */
export function requireQueueDashboardAuth(req: Request, res: Response, next: NextFunction) {
  const { dashboardToken } = config.auth;

  if (dashboardToken && req.query.token === dashboardToken) {
    return next();
  }

  if (req.isAuthenticated() && req.user) {
    return next();
  }

  return res.redirect(`${config.urls.backend}/api/auth/google`);
}
