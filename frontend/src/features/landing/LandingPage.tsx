import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Subtle crescent motif behind the hero — BRAND.md §7. Decorative; aria-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-20 hidden h-[600px] w-[600px] opacity-[0.05] md:block"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl">
          <img src="/brand/heron.svg" alt="" width={88} height={88} aria-hidden="true" />
          <h1 className="mt-8 text-5xl font-semibold tracking-tight md:text-6xl">
            Care, watched closely.
          </h1>
          <p className="mt-6 text-lg text-ink-muted">
            Heron is a telehealth platform built on the posture its name describes:
            stillness, watchfulness, precision. From the first symptom search to the
            consultation that follows, Heron subtracts anxiety from healthcare
            instead of adding to it.
          </p>
          <div className="mt-10 flex gap-3">
            <Button asChild size="lg">
              <Link to="/doctors">Browse doctors</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
