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
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { SPECIALIZATIONS } from '@/features/doctors/specializations';
import { useAuth, type AuthIntent } from './AuthContext';

type Mode = 'login' | 'register';
type Role = 'PATIENT' | 'DOCTOR';

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
        <Input
          id="login-password"
          type="password"
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
  ) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>('PATIENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState<string>('GENERAL_PRACTICE');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (role === 'PATIENT') {
        await onRegisterPatient(email, password, name);
      } else {
        await onRegisterDoctor(email, password, name, specialization);
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
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-ink-muted">At least 8 characters.</p>
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
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
