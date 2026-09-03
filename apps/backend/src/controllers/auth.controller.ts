import { NextFunction, Request, Response } from 'express';
import passport from '../config/passport';
import { config } from '../config';
import { logger } from '../config/logger';

export class AuthController {
  /**
   * Start Google OAuth.
   *
   * If the caller already holds a valid session, skip the round trip to Google
   * entirely and send them to the dashboard. Bouncing an authenticated user
   * through the consent screen achieves nothing and strands them there whenever
   * Google decides to interrupt the flow (account chooser, re-consent, or a
   * Workspace policy prompt).
   */
  googleAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && req.user) {
      logger.info(`Already authenticated, skipping Google redirect for ${req.user.email}`);
      return res.redirect(`${config.urls.frontend}/dashboard`);
    }

    return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  };

  googleCallback = [
    // On failure, send the user back to the login screen at the app root. The SPA
    // has no `/login` route, so redirecting there would silently bounce through
    // the catch-all and look like nothing happened.
    passport.authenticate('google', {
      failureRedirect: `${config.urls.frontend}/?error=auth_failed`,
    }),
    (req: Request, res: Response) => {
      // Persist the session to Redis *before* redirecting.
      //
      // The store write is asynchronous. Without waiting for it, the browser can
      // follow the redirect and the SPA can call /api/auth/me before the session
      // exists in Redis - the request then 401s and the user is bounced straight
      // back to the login screen.
      req.session.save((err) => {
        if (err) {
          logger.error('Failed to persist session after Google login:', err);
          return res.redirect(`${config.urls.frontend}/?error=session_failed`);
        }

        res.redirect(`${config.urls.frontend}/dashboard`);
      });
    },
  ];

  async logout(req: Request, res: Response) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session destruction failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      });
    });
  }

  async me(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Wrapped in `data` to match every other endpoint's envelope. Returning a
    // bare `{ user }` here made the client read `undefined` and treat an
    // authenticated response as a signed-out one.
    return res.json({ data: { user: req.user } });
  }
}

export const authController = new AuthController();
