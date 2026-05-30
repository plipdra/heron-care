import { type FormEvent, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import {
  validateEmail,
  validatePassword,
  validateRequiredName,
} from '@/lib/validation';
import { SPECIALIZATIONS } from '@/features/doctors/specializations';
import { useAuth, type AuthIntent } from './AuthContext';

type Mode = 'login' | 'register';
type Role = 'PATIENT' | 'DOCTOR';

// A plausible n-digit license number for the demo pre-fill (MVP flavor only).
function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// Social sign-in is MVP flavor only — the button is intentionally inert; real
// auth is the email/password forms below. Kept so the flow reads as designed.
function GoogleAuthButton() {
  return (
    <>
      <button
        type="button"
        onClick={() => {}}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-primary-tint/40"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

const INTENT_COPY: Record<AuthIntent, { title: string; description: string }> = {
  general: {
    title: 'Sign in to Heron',
    description: 'Welcome back.',
  },
  booking: {
    title: 'Sign in to book',
    description: 'Your appointment will be saved to your account.',
  },
  'ai-recommendation': {
    title: 'Sign in for recommendations tailored to your medical history',
    description: 'Your symptom history stays with your account.',
  },
  'protected-route': {
    title: 'Sign in to continue',
    description: 'This page is only visible to signed-in members.',
  },
};

const REGISTER_COPY = {
  title: 'Create a Heron account',
  description: 'Tell us about yourself.',
};

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalIntent,
    closeAuthModal,
    login,
    registerPatient,
    registerDoctor,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  const copy =
    mode === 'register'
      ? REGISTER_COPY
      : authModalIntent
        ? INTENT_COPY[authModalIntent]
        : INTENT_COPY.general;

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-md bg-primary-tint p-1">
          <button
            type="button"
            className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>

        {mode === 'login' ? (
          <LoginForm onSubmit={login} />
        ) : (
          <RegisterForm
            onRegisterPatient={registerPatient}
            onRegisterDoctor={registerDoctor}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoginForm({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem?.detail ?? err.message
          : 'Sign in failed.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <GoogleAuthButton />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">Password</Label>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

function RegisterForm({
  onRegisterPatient,
  onRegisterDoctor,
}: {
  onRegisterPatient: (email: string, password: string, name: string) => Promise<void>;
  onRegisterDoctor: (
    email: string,
    password: string,
    name: string,
    specialization: string,
    prcLicenseNo?: string,
    ptrNo?: string,
  ) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>('PATIENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState<string>('GENERAL_PRACTICE');
  // PRC/PTR are pre-filled with plausible numbers for the demo (MVP flavor — not
  // a verified credential). The doctor can edit them; the backend also generates
  // a fallback if either is cleared. Generated once so they stay stable while the
  // form is open.
  const [prcLicenseNo, setPrcLicenseNo] = useState(() => randomDigits(7));
  const [ptrNo, setPtrNo] = useState(() => randomDigits(7));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Mirror the backend signup rules for instant feedback. The backend is still
    // the authoritative gate and will re-reject anything that slips past here.
    const nextFieldErrors = {
      name: validateRequiredName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.name || nextFieldErrors.email || nextFieldErrors.password) {
      return;
    }

    setPending(true);
    try {
      if (role === 'PATIENT') {
        await onRegisterPatient(email, password, name);
      } else {
        await onRegisterDoctor(
          email,
          password,
          name,
          specialization,
          prcLicenseNo.trim() || undefined,
          ptrNo.trim() || undefined,
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem?.detail ?? err.message
          : 'Could not create your account.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <GoogleAuthButton />
      <div className="flex flex-col gap-1.5">
        <Label>I'm registering as a</Label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              role === 'PATIENT'
                ? 'border-primary bg-primary-tint text-primary'
                : 'border-line text-ink-muted hover:border-primary'
            }`}
            onClick={() => setRole('PATIENT')}
          >
            Patient
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              role === 'DOCTOR'
                ? 'border-primary bg-primary-tint text-primary'
                : 'border-line text-ink-muted hover:border-primary'
            }`}
            onClick={() => setRole('DOCTOR')}
          >
            Doctor
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-name">Full name</Label>
        <Input
          id="register-name"
          required
          maxLength={200}
          aria-invalid={fieldErrors.name ? true : undefined}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
          }}
        />
        {fieldErrors.name && <p className="text-sm text-danger">{fieldErrors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
          }}
        />
        {fieldErrors.email && <p className="text-sm text-danger">{fieldErrors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-password">Password</Label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={fieldErrors.password ? true : undefined}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
          }}
        />
        {fieldErrors.password ? (
          <p className="text-sm text-danger">{fieldErrors.password}</p>
        ) : (
          <p className="text-xs text-ink-muted">
            At least 8 characters, including a letter and a number.
          </p>
        )}
      </div>

      {role === 'DOCTOR' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-specialization">Specialisation</Label>
          <select
            id="register-specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            className="flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            {SPECIALIZATIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-prc">PRC license no.</Label>
              <Input
                id="register-prc"
                inputMode="numeric"
                maxLength={40}
                value={prcLicenseNo}
                onChange={(e) => setPrcLicenseNo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-ptr">PTR no.</Label>
              <Input
                id="register-ptr"
                inputMode="numeric"
                maxLength={40}
                value={ptrNo}
                onChange={(e) => setPtrNo(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Pre-filled for the demo — edit if needed.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
