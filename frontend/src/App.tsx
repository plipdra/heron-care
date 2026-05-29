import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { AccountMenu } from '@/components/shared/AccountMenu';
import { AppFooter } from '@/components/shared/AppFooter';
import { AppHeader } from '@/components/shared/AppHeader';
import { BackToTop } from '@/components/shared/BackToTop';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
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
import { LandingPage } from '@/features/landing/LandingPage';

// Route pages are code-split: only the landing page (the common first paint)
// ships in the initial bundle; the rest load on navigation behind the Suspense
// fallback below. These are named exports, so map each onto a default for lazy().
const DoctorsListPage = lazy(() =>
  import('@/features/doctors/DoctorsListPage').then((m) => ({ default: m.DoctorsListPage })),
);
const DoctorProfilePage = lazy(() =>
  import('@/features/doctors/DoctorProfilePage').then((m) => ({ default: m.DoctorProfilePage })),
);
const RecommendPage = lazy(() =>
  import('@/features/recommend/RecommendPage').then((m) => ({ default: m.RecommendPage })),
);
const MyDoctorProfilePage = lazy(() =>
  import('@/features/doctors/MyDoctorProfilePage').then((m) => ({ default: m.MyDoctorProfilePage })),
);
const AppointmentsPage = lazy(() =>
  import('@/features/booking/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })),
);
// Printable clinical documents render bare (no app chrome) and open in a new tab.
const VisitSummaryDocument = lazy(() =>
  import('@/features/documents/VisitSummaryDocument').then((m) => ({ default: m.VisitSummaryDocument })),
);
const PrescriptionDocument = lazy(() =>
  import('@/features/documents/PrescriptionDocument').then((m) => ({ default: m.PrescriptionDocument })),
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Bare, chrome-less document routes — printable, opened in a new tab. */}
              <Route
                path="/documents/visit-summary/:bookingId"
                element={
                  <RequireAuth>
                    <VisitSummaryDocument />
                  </RequireAuth>
                }
              />
              <Route
                path="/documents/prescription/:bookingId"
                element={
                  <RequireAuth>
                    <PrescriptionDocument />
                  </RequireAuth>
                }
              />

              {/* Everything else renders inside the app shell (header + footer). */}
              <Route element={<ChromeLayout />}>
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
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// The standard app shell: skip link, header, footer, and the global auth modal +
// back-to-top. Chrome pages render through the <Outlet />. Document routes opt out
// of this layout entirely so a printable sheet has no app furniture.
function ChromeLayout() {
  return (
    <>
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
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
        <AppFooter />
      </div>
      <AuthModal />
      <BackToTop />
    </>
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
      { to: '/recommend', label: 'Find a doctor' },
      { to: '/doctors', label: 'Browse doctors' },
      { to: '/appointments', label: 'Appointments' },
    ];
  }
  return [
    { to: '/recommend', label: 'Find a doctor' },
    { to: '/doctors', label: 'Browse doctors' },
  ]; // guest
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

// Shown while a code-split route chunk loads. Centered brand spinner, sized to
// fill the content area so the header/footer stay put during the swap.
function RouteFallback() {
  return (
    <main className="container mx-auto flex justify-center px-4 py-20">
      <CrescentSpinner size={64} />
    </main>
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
