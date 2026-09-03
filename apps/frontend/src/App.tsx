import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScheduledEmailsPage } from './pages/ScheduledEmailsPage';
import { SentEmailsPage } from './pages/SentEmailsPage';
import { SendersPage } from './pages/SendersPage';
import { SlackPage } from './pages/SlackPage';
import { QueueMonitorPage } from './pages/QueueMonitorPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

/** Every authenticated page shares the same guard. */
const PROTECTED_ROUTES = [
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/emails/scheduled', element: <ScheduledEmailsPage /> },
  { path: '/emails/sent', element: <SentEmailsPage /> },
  { path: '/senders', element: <SendersPage /> },
  { path: '/slack', element: <SlackPage /> },
  { path: '/queue', element: <QueueMonitorPage /> },
];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          {PROTECTED_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<ProtectedRoute>{route.element}</ProtectedRoute>}
            />
          ))}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            // Match the app's border/shadow language instead of sonner's default.
            classNames: {
              toast:
                'rounded-xl border border-line bg-surface text-fg shadow-popover',
              title: 'text-sm font-medium text-fg',
              description: 'text-xs text-fg-subtle',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
