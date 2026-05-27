import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';

export function LandingPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';
  return (
    <main className="relative overflow-hidden">
      {/* Subtle crescent motif behind the hero — BRAND.md §7. Decorative; aria-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-20 hidden h-[900px] w-[900px] opacity-[0.10] md:block"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl">
          <img
            src="/brand/heron.svg"
            alt=""
            width={176}
            height={176}
            aria-hidden="true"
          />
          <h1 className="mt-8 text-5xl font-semibold tracking-tight md:text-6xl">
            Find a doctor in minutes.
          </h1>
          <p className="mt-4 text-xl text-ink-muted md:text-2xl">
            Care, watched closely.
          </p>
          <div className="mt-10 flex gap-3">
            <Button asChild size="lg">
              {isDoctor ? (
                <Link to="/appointments">Go to your consults</Link>
              ) : (
                <Link to="/doctors">Browse doctors</Link>
              )}
            </Button>
          </div>
          <p className="mt-16 text-lg text-ink-muted">
            Heron is a telehealth platform built on the posture its name describes:
            stillness, watchfulness, precision. From the first symptom search to the
            consultation that follows, Heron subtracts anxiety from healthcare
            instead of adding to it.
          </p>
        </div>
      </section>
    </main>
  );
}
