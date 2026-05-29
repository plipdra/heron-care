import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { tokenStore } from '@/lib/tokenStore';
import {
  useLogin,
  useLogout,
  useRegisterDoctor,
  useRegisterPatient,
  type AuthResponse,
} from './api';

type Role = 'PATIENT' | 'DOCTOR';

export type User = {
  id: string;
  email: string;
  role: Role;
};

// Intent drives the modal's heading copy. The 'ai-recommendation' wording is
// load-bearing for the marketplace-auth product story — specific copy
// converts better than a generic auth wall.
export type AuthIntent =
  | 'general'
  | 'booking'
  | 'ai-recommendation'
  | 'protected-route';

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalIntent: AuthIntent | null;
  login: (email: string, password: string) => Promise<void>;
  registerPatient: (email: string, password: string, name: string) => Promise<void>;
  registerDoctor: (
    email: string,
    password: string,
    name: string,
    specialization: string,
    prcLicenseNo?: string,
    ptrNo?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: (intent?: AuthIntent) => void;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// JWT body decode — no signature verification, server enforces signatures on
// every request. Used only to populate UI state from a token already in storage.
function decodeJwt<T>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

function userFromToken(token: string | null): User | null {
  if (!token) return null;
  const claims = decodeJwt<{ sub: string; email: string; role: string }>(token);
  if (!claims || !claims.sub) return null;
  return { id: claims.sub, email: claims.email, role: claims.role as Role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    userFromToken(tokenStore.getAccess()),
  );
  const [authModalIntent, setAuthModalIntent] = useState<AuthIntent | null>(null);

  const loginMutation = useLogin();
  const registerPatientMutation = useRegisterPatient();
  const registerDoctorMutation = useRegisterDoctor();
  const logoutMutation = useLogout();

  const applyAuthResponse = useCallback((response: AuthResponse) => {
    tokenStore.set(response.accessToken, response.refreshToken);
    setUser(userFromToken(response.accessToken));
    setAuthModalIntent(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginMutation.mutateAsync({ email, password });
      applyAuthResponse(response);
    },
    [loginMutation, applyAuthResponse],
  );

  const registerPatient = useCallback(
    async (email: string, password: string, name: string) => {
      const response = await registerPatientMutation.mutateAsync({
        email,
        password,
        name,
      });
      applyAuthResponse(response);
    },
    [registerPatientMutation, applyAuthResponse],
  );

  const registerDoctor = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      specialization: string,
      prcLicenseNo?: string,
      ptrNo?: string,
    ) => {
      const response = await registerDoctorMutation.mutateAsync({
        email,
        password,
        name,
        specialization,
        prcLicenseNo,
        ptrNo,
      });
      applyAuthResponse(response);
    },
    [registerDoctorMutation, applyAuthResponse],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Best-effort — even if the server call fails, clear local state.
    }
    tokenStore.clear();
    setUser(null);
  }, [logoutMutation]);

  const openAuthModal = useCallback((intent: AuthIntent = 'general') => {
    setAuthModalIntent(intent);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalIntent(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAuthModalOpen: authModalIntent !== null,
      authModalIntent,
      login,
      registerPatient,
      registerDoctor,
      logout,
      openAuthModal,
      closeAuthModal,
    }),
    [
      user,
      authModalIntent,
      login,
      registerPatient,
      registerDoctor,
      logout,
      openAuthModal,
      closeAuthModal,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
