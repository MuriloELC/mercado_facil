import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthSession } from '@/api/types';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from './session-store';

type AuthState = {
  isLoading: boolean;
  session: AuthSession | null;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  isLoading: true,
  session: null,
  signIn: async () => undefined,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let mounted = true;

    loadStoredSession()
      .then((storedSession) => {
        if (mounted) {
          setSession(storedSession);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (nextSession: AuthSession) => {
    await saveStoredSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      session,
      signIn,
      signOut,
    }),
    [isLoading, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return React.use(AuthContext);
}
