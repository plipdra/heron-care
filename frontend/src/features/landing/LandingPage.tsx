import { useAuth } from '@/features/auth/AuthContext';
import { DoctorHome } from './DoctorHome';
import { HomeSymptomSearch } from './HomeSymptomSearch';
import { HomeTrustBand } from './HomeTrustBand';

// Homepage: the AI symptom-router is the hero (left-aligned, with the crescent
// motif drifting top-right), and a trust band sits below — answering an anxious
// first-timer's "is this real, is it safe, where do I start?" without gating the
// hero. A logged-in doctor sees their own welcome instead.
export function LandingPage() {
  const { user } = useAuth();
  if (user?.role === 'DOCTOR') return <DoctorHome />;

  return (
    <main className="relative overflow-hidden">
      {/* Subtle crescent motif behind the hero — decorative, aria-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-20 hidden h-[820px] w-[820px] opacity-[0.10] md:block"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <section className="container mx-auto px-4 py-20 md:py-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Describe what's going on.
            <br />
            We'll find the right doctor.
          </h1>
          <p className="mt-3 text-lg text-ink-muted">Care, watched closely.</p>
          <div className="mt-8">
            <HomeSymptomSearch align="left" />
          </div>
        </div>
      </section>

      <HomeTrustBand />
    </main>
  );
}
