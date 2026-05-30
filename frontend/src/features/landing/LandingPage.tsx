import { Clock, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { DoctorHome } from './DoctorHome';
import { HomeSymptomSearch } from './HomeSymptomSearch';

const HERO_TRUST = [
  { icon: ShieldCheck, h: 'Board-certified doctors', p: 'Every specialist is verified and licensed.' },
  { icon: Clock, h: 'Same-week availability', p: 'Most specialties have openings within days.' },
  { icon: Lock, h: 'Private & secure', p: 'Your description is encrypted and never sold.' },
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
      {/* Crescent motif CENTERED behind the hero (screens.css .hero-crescent),
          low opacity. Decorative, aria-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-150px] h-[560px] w-[560px] -translate-x-[52%] opacity-[0.06]"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <section className="container relative mx-auto flex flex-col items-center px-4 py-20 text-center md:py-24">
        {/* Brand line as an understated editorial kicker — wide-tracked small caps
            flanked by fading hairlines, not a bordered pill. */}
        <span className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-primary-600">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/35" />
          Care, watched closely
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/35" />
        </span>
        <h1 className="mt-6 max-w-[16ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight text-ink md:text-[52px]">
          Tell us what's wrong. We'll find the{' '}
          <span className="text-primary">right doctor</span>.
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-muted">
          Describe your symptoms in a sentence. Heron points you to the specialist
          most likely to help — then shows who's available.
        </p>
        <div className="mt-8 w-full max-w-[620px]">
          <HomeSymptomSearch align="center" />
        </div>

        {/* Trust band — one bordered card row, divided into three. The sage 'care'
            accent (non-clinical) lives here on the icon tiles. */}
        <dl className="mt-10 grid w-full max-w-3xl gap-px overflow-hidden rounded-lg border border-line bg-line text-left shadow-sm sm:grid-cols-3">
          {HERO_TRUST.map((t) => (
            <div key={t.h} className="flex items-start gap-3 bg-surface p-5">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-care-tint text-care">
                <t.icon className="h-5 w-5" />
              </span>
              <div>
                <dt className="text-[15px] font-semibold text-ink">{t.h}</dt>
                <dd className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">{t.p}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
