import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api } from '../../lib/api';
import { authClient } from '../../lib/auth-client';
import type { CurrentUser } from '../../types';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(({ user: nextUser }) => {
        setUser(nextUser);
        setError(null);
      })
      .catch((authError: unknown) => {
        if (authError instanceof ApiError && authError.status === 401) {
          setUser(null);
          return;
        }
        setError(formatError(authError));
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(() => {
    void authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }, []);

  const signOut = useCallback(() => {
    void authClient.signOut().finally(() => setUser(null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      signOut,
    }),
    [error, loading, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to process the request.';
}
