import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Route guard for auth-gated routes. Opens the auth modal with a specific
// intent when an unauthenticated visitor lands; renders nothing useful below
// until they sign in.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, openAuthModal } = useAuth();

  useEffect(() => {
    if (!user) {
      openAuthModal('protected-route');
    }
  }, [user, openAuthModal]);

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in to continue</h2>
        <p className="mt-2 text-ink-muted">
          This page is only visible to signed-in members.
        </p>
      </main>
    );
  }
  return <>{children}</>;
}
