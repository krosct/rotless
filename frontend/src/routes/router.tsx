import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Dashboard } from '@/pages/Dashboard';
import { BatchNew } from '@/pages/BatchNew';
import { BatchEdit } from '@/pages/BatchEdit';
import { Settings } from '@/pages/Settings';
import { HouseholdSettings } from '@/pages/HouseholdSettings';
import { HouseholdActivities } from '@/pages/HouseholdActivities';
import { HouseholdReports } from '@/pages/HouseholdReports';
import { AcceptInvite } from '@/pages/AcceptInvite';
import { resolveReturnTo, clearInviteReturnTo } from '@/utils/inviteReturnTo';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
          <p className="text-xs text-stone-500 font-medium">Carregando despensa...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    const returnTo = resolveReturnTo(stateReturnTo);
    clearInviteReturnTo();
    return <Navigate to={returnTo || '/dashboard'} replace />;
  }

  return <>{children}</>;
}

export function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <Login />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <Register />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/batches/new',
    element: (
      <ProtectedRoute>
        <BatchNew />
      </ProtectedRoute>
    ),
  },
  {
    path: '/batches/:id/edit',
    element: (
      <ProtectedRoute>
        <BatchEdit />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
  {
    path: '/households/:householdId/settings',
    element: (
      <ProtectedRoute>
        <HouseholdSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: '/households/:householdId/activities',
    element: (
      <ProtectedRoute>
        <HouseholdActivities />
      </ProtectedRoute>
    ),
  },
  {
    path: '/households/:householdId/reports',
    element: (
      <ProtectedRoute>
        <HouseholdReports />
      </ProtectedRoute>
    ),
  },
  {
    path: '/invite/:token',
    element: <AcceptInvite />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
