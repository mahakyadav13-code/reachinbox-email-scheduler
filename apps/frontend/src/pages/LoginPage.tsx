import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, Gauge, Loader2, Search, ShieldCheck } from 'lucide-react';
import { authApi } from '../services/api';
import { redirectUrls } from '../lib/config';
import { BrandLockup, BrandMark } from '../components/layout/BrandMark';

const HIGHLIGHTS = [
  {
    icon: CalendarClock,
    title: 'Queue-backed scheduling',
    copy: 'Delayed jobs live in Redis, so a restart never loses or duplicates a send.',
  },
  {
    icon: Gauge,
    title: 'Per-sender throttling',
    copy: 'Hourly budgets per identity. Overflow reschedules in order, never dropped.',
  },
  {
    icon: Search,
    title: 'Searchable history',
    copy: 'Every scheduled and sent message indexed for full-text search.',
  },
];

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');

  // Skip the login screen when a session already exists, otherwise an
  // authenticated user sees this page and clicking through just round-trips.
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
    retry: false,
  });

  useEffect(() => {
    if (authError === 'auth_failed') {
      toast.error('Google sign-in failed. Please try again.');
    } else if (authError === 'session_failed') {
      toast.error('Signed in, but the session could not be saved. Please retry.');
    }
  }, [authError]);

  if (!isLoading && data?.data?.data?.user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ------------------------------------------------------------ brand side */}
      <aside className="relative hidden w-[46%] max-w-3xl flex-col justify-between overflow-hidden bg-black p-12 lg:flex">
        {/* Blurred gradient mesh, drifting slowly. */}
        <div className="absolute inset-0 opacity-70" aria-hidden>
          <div className="bg-mesh absolute -inset-[20%] animate-float blur-[90px]" />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"
          aria-hidden
        />

        <div className="relative">
          <BrandLockup subtitle={null} inverted />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-display font-semibold text-white">
            Cold email that
            <br />
            paces itself.
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/60">
            Schedule thousands of messages, respect per-sender limits, and keep a complete,
            searchable record of every send.
          </p>

          <ul className="mt-12 space-y-6">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item.title}
                className="flex animate-slide-up gap-4"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                {/* Hero is always dark, so these use white alphas rather than
                    themed surfaces - otherwise they invert in dark mode. */}
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 backdrop-blur">
                  <item.icon className="h-[18px] w-[18px] text-white" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/50">{item.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-2xs text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Google OAuth Â· sessions stored server-side in Redis
        </p>
      </aside>

      {/* ------------------------------------------------------------- form side */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Compact mark for small screens, where the aside is hidden. */}
          <div className="mb-12 lg:hidden">
            <BrandMark size="lg" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-fg">
            Welcome back
          </h1>
          <p className="mt-2.5 text-[0.9375rem] text-fg-subtle">
            Sign in to reach your scheduler.
          </p>

          <button
            type="button"
            onClick={() => {
              // Full-page navigation: the consent screen cannot load via XHR.
              window.location.href = redirectUrls.googleLogin;
            }}
            disabled={isLoading}
            className="group mt-10 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-surface text-sm font-medium text-fg shadow-soft ring-1 ring-inset ring-line transition-all duration-200 ease-spring hover:-translate-y-0.5 hover:shadow-lift hover:ring-line-strong disabled:pointer-events-none disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-hidden />
            ) : (
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="mt-8 flex items-center gap-3">
            <span className="h-px flex-1 bg-surface-hover" aria-hidden />
            <span className="text-2xs uppercase tracking-widest text-fg-subtle">Test mode</span>
            <span className="h-px flex-1 bg-surface-hover" aria-hidden />
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-fg-subtle">
            Messages are delivered through a sandboxed SMTP mailbox, so nothing reaches a real
            inbox during evaluation.
          </p>
        </div>
      </main>
    </div>
  );
}
