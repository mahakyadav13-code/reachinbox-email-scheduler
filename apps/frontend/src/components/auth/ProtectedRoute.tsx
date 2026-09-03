import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Loader2, ServerCrash } from 'lucide-react';
import { authApi } from '../../services/api';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Gates authenticated pages on a real session check against /api/auth/me.
 *
 * Only an actual 401 counts as "not logged in". A network failure or a 5xx means
 * the API is unreachable (restarting in dev, for instance) - treating that as a
 * logout would silently bounce a signed-in user back to the login screen, so
 * those are retried and surfaced as an error state instead.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data, isPending, error } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      const status = (err as AxiosError)?.response?.status;
      if (status === 401) return false; // genuinely signed out
      return failureCount < 3; // transient - the API may be restarting
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Checking your sessionâ€¦</p>
        </div>
      </div>
    );
  }

  if (error) {
    const status = (error as AxiosError)?.response?.status;

    // Signed out - send them to the login screen.
    if (status === 401) {
      return <Navigate to="/" replace />;
    }

    // API unreachable. Say so rather than pretending the user is logged out.
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm text-center">
          <ServerCrash className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Can't reach the server
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            The API at {import.meta.env.VITE_API_URL || 'http://localhost:5000'} did
            not respond. If it is restarting, this will clear on its own.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data?.data?.data?.user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
