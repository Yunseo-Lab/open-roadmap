import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { FullScreenMessage } from '../components/FullScreenMessage';
import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  children: ReactNode;
  loadingBody: string;
}

export function RequireAuth({ children, loadingBody }: RequireAuthProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return <FullScreenMessage title="Loadmap" body={loadingBody} />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
