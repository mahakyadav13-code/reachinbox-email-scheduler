/**
 * Single source of truth for backend URLs.
 *
 * Everything that needs to reach the API — including full-page redirects for
 * OAuth, which cannot go through axios — reads from here, so the app can be
 * pointed at a different host by setting VITE_API_URL alone.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const backendUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Endpoints reached by navigating the browser rather than by XHR. */
export const redirectUrls = {
  googleLogin: backendUrl('/api/auth/google'),
  slackConnect: backendUrl('/api/slack/connect'),
  queueDashboard: backendUrl('/admin/queues'),
};
