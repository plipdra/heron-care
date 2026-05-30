import { Clock, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { DoctorHome } from './DoctorHome';
import { HomeSymptomSearch } from './HomeSymptomSearch';
import { HomeTrustBand } from './HomeTrustBand';

const HERO_TRUST = [
  { icon: ShieldCheck, h: 'Board-certified doctors', p: 'Every specialist is verified and licensed.' },
  { icon: Clock, h: 'Real-time availability', p: 'You see live open times before you commit.' },
  { icon: Lock, h: 'Private by design', p: 'Your description is only used to match you.' },
];

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
            Care, watched closely
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-primary-800 md:text-5xl">
            Tell us what's wrong.
            <br />
            We'll find the <span className="text-accent-deep">right doctor</span>.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">
            Describe your symptoms in a sentence. Heron points you to the specialist
            most likely to help — then shows who's available.
          </p>
          <div className="mt-8">
            <HomeSymptomSearch align="left" />
          </div>

          {/* Inline trust band — why an anxious first-timer can rely on this.
              One bordered, soft-elevated card row, divided into three. */}
          <dl className="mt-10 grid max-w-2xl divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {HERO_TRUST.map((t) => (
              <div key={t.h} className="flex flex-col gap-1.5 p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <t.icon className="h-4 w-4" />
                </span>
                <dt className="text-sm font-semibold text-ink">{t.h}</dt>
                <dd className="text-xs leading-relaxed text-ink-muted">{t.p}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <HomeTrustBand />
    </main>
  );
}
