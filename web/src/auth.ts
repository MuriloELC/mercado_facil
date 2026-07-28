import { createContext, useContext } from 'react';
import { AuthUser } from './api/types';

export type AuthSession = {
  token: string;
  user: AuthUser;
};

type AuthState = {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
};

export const AuthContext = createContext<AuthState>({
  session: null,
  setSession: () => undefined,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
