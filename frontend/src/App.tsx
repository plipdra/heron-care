import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { AppFooter } from '@/components/shared/AppFooter';
import { AppHeader } from '@/components/shared/AppHeader';
import { BackToTop } from '@/components/shared/BackToTop';
import { ScrollToTop } from '@/components/shared/ScrollToTop';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/features/auth/AuthModal';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { DoctorProfilePage } from '@/features/doctors/DoctorProfilePage';
import { DoctorsListPage } from '@/features/doctors/DoctorsListPage';
import { MyDoctorProfilePage } from '@/features/doctors/MyDoctorProfilePage';
import { AppointmentsPage } from '@/features/booking/AppointmentsPage';
import { LandingPage } from '@/features/landing/LandingPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <div className="flex min-h-screen flex-col">
            <AppHeader>
              <HeaderNav />
            </AppHeader>
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                  path="/doctors"
                  element={
                    <PatientFacing>
                      <DoctorsListPage />
                    </PatientFacing>
                  }
                />
                <Route
                  path="/doctors/:id"
                  element={
                    <PatientFacing>
                      <DoctorProfilePage />
                    </PatientFacing>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <RequireAuth>
                      <AppointmentsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <MyDoctorProfilePage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
            <AppFooter />
          </div>
          <AuthModal />
          <BackToTop />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// The patient marketplace (browse doctors) isn't a doctor's surface — a
// logged-in doctor is sent to their own consults instead. Guests and patients
// pass through. This also catches the guest -> browse -> log-in-as-doctor path,
// since the route re-evaluates on the auth state change.
function PatientFacing({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'DOCTOR') {
    return <Navigate to="/appointments" replace />;
  }
  return <>{children}</>;
}

function HeaderNav() {
  const { user, openAuthModal, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <>
      {user?.role !== 'DOCTOR' && (
        <Link
          to="/doctors"
          className="text-sm font-medium text-ink hover:text-primary"
        >
          Browse doctors
        </Link>
      )}
      {user ? (
        <>
          <Link
            to="/appointments"
            className="text-sm font-medium text-ink hover:text-primary"
          >
            {user.role === 'DOCTOR' ? 'Consults' : 'Appointments'}
          </Link>
          <Link
            to="/profile"
            className="text-sm font-medium text-ink hover:text-primary"
          >
            Profile
          </Link>
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => openAuthModal('general')}>
          Sign in
        </Button>
      )}
    </>
  );
}

function NotFoundPage() {
  return (
    <main className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-ink-muted">
        The path you tried doesn't exist on Heron.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back home</Link>
      </Button>
    </main>
  );
}
