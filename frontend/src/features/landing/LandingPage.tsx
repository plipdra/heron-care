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
    <main className="relative overflow-hidden bg-[linear-gradient(180deg,#EEF3FB_0%,#F7F9FC_40%,#FFFFFF_100%)]">
      {/* Crescent motif behind the hero — the brand's richness vehicle, drifting
          top-right at low opacity. Decorative, aria-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-24 hidden h-[880px] w-[880px] opacity-[0.12] md:block"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-ai-glow bg-ai-surface px-3 py-1 text-xs font-semibold tracking-wide text-primary-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            AI symptom router
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-primary-800 md:text-5xl">
            Describe what's going on.
            <br />
            We'll find the right doctor.
          </h1>
          <p className="mt-4 text-lg text-ink-muted">
            Tell us your symptoms — we suggest the right kind of specialist and the
            doctors who fit. <span className="text-ink">Care, watched closely.</span>
          </p>
          <div className="mt-8">
            <HomeSymptomSearch align="left" />
          </div>
        </div>
      </section>

      <HomeTrustBand />
    </main>
  );
}
