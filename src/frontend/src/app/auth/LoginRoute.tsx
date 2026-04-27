import { Navigate } from 'react-router';
import { FullScreenMessage } from '../components/FullScreenMessage';
import { LoginScreen } from '../components/LoginScreen';
import { useAuth } from './AuthProvider';

export function LoginRoute() {
  const { error, loading, signIn, user } = useAuth();

  if (loading) {
    return <FullScreenMessage title="Loadmap" body="Checking your account." />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginScreen onLogin={signIn} error={error} />;
}
