import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { AccountMenu } from '@/components/shared/AccountMenu';
import { AppFooter } from '@/components/shared/AppFooter';
import { AppHeader } from '@/components/shared/AppHeader';
import { BackToTop } from '@/components/shared/BackToTop';
import { ScrollToTop } from '@/components/shared/ScrollToTop';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthModal } from '@/features/auth/AuthModal';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { DoctorProfilePage } from '@/features/doctors/DoctorProfilePage';
import { DoctorsListPage } from '@/features/doctors/DoctorsListPage';
import { RecommendPage } from '@/features/recommend/RecommendPage';
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
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <AppHeader>
              <HeaderNav />
            </AppHeader>
            <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
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
                  path="/recommend"
                  element={
                    <PatientFacing>
                      <RecommendPage />
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

type NavDest = { to: string; label: string };

// Role-based primary destinations — the visibility matrix lives here. Profile and
// Sign out are NOT in this bar; they're in the account menu. "Appointments" and
// "Consults" are the same route with a role-dependent label.
function primaryDestinations(role: string | undefined): NavDest[] {
  if (role === 'DOCTOR') return [{ to: '/appointments', label: 'Consults' }];
  if (role === 'PATIENT') {
    return [
      { to: '/doctors', label: 'Browse doctors' },
      { to: '/appointments', label: 'Appointments' },
    ];
  }
  return [{ to: '/doctors', label: 'Browse doctors' }]; // guest
}

function HeaderNav() {
  const { user, openAuthModal } = useAuth();
  const links = primaryDestinations(user?.role);

  return (
    <>
      {/* Zone 2 — primary nav (desktop). Active link: weight + colour + an
          underline, so the current page is signalled by more than colour alone.
          NavLink sets aria-current="page" on the active item for free. */}
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn(
                'relative rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive
                  ? "font-semibold text-primary after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-primary after:content-['']"
                  : 'font-medium text-ink-muted hover:text-ink',
              )
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* Zone 3 — utility cluster, the right anchor. ml-auto separates it from the
          primary nav with whitespace. */}
      <div className="ml-auto flex items-center gap-1.5">
        <MobilePrimaryNav links={links} />
        {user ? (
          <>
            <NotificationBell />
            <AccountMenu />
          </>
        ) : (
          <Button size="sm" onClick={() => openAuthModal('general')}>
            Sign in
          </Button>
        )}
      </div>
    </>
  );
}

// Below md the primary destinations collapse into a compact menu so the bar never
// crowds; the bell + account menu (or Sign in) stay visible alongside it.
function MobilePrimaryNav({ links }: { links: NavDest[] }) {
  return (
    // Labeled nav so the "Primary" landmark survives at narrow widths (the desktop
    // <nav> is display:none here, hence removed from the a11y tree). Only one of
    // the two is ever rendered per breakpoint, so the tree has a single nav.
    <nav aria-label="Primary" className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {links.map((l) => (
            <DropdownMenuItem key={l.to} asChild>
              <NavLink to={l.to}>{l.label}</NavLink>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
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
