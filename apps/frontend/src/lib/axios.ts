import axios from 'axios';
import { API_BASE_URL } from './config';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Send the user back to login on session expiry, but let the auth probe on
    // the login screen fail quietly instead of triggering a redirect loop.
    const isAuthProbe = error.config?.url?.includes('/api/auth/me');

    if (error.response?.status === 401 && !isAuthProbe) {
      window.location.href = '/';
    }

    return Promise.reject(error);
  }
);
