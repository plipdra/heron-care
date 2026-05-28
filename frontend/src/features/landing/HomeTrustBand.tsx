import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, MessageSquare, ShieldCheck, Stethoscope } from 'lucide-react';

// Below-the-hero reassurance: how it works, the real-doctor cue, and a calm
// privacy/safety line — answering an anxious first-timer's "is this real, is it
// safe, where do I start?" It sits BELOW the hero (never gating it) and uses no
// alarm colour, urgency, or fabricated social proof.
export function HomeTrustBand() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="container mx-auto px-4 py-16 md:py-20">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-ink-muted">
          How it works
        </h2>
        <ol className="mx-auto mt-8 grid max-w-4xl gap-8 sm:grid-cols-3">
          <Step
            icon={<MessageSquare className="h-5 w-5" />}
            title="Describe it"
            body="Tell us what's going on, in your own words."
          />
          <Step
            icon={<Stethoscope className="h-5 w-5" />}
            title="We match you"
            body="We suggest the right type of specialist — not a diagnosis."
          />
          <Step
            icon={<CalendarCheck className="h-5 w-5" />}
            title="Book a video visit"
            body="Pick a time. You only sign in when you're ready to book."
          />
        </ol>

        <div className="mx-auto mt-14 flex max-w-3xl flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium text-ink">30 doctors across 10 specialties</p>
          <Link to="/doctors" className="text-sm text-primary hover:underline">
            Browse all doctors →
          </Link>
          <p className="mt-2 flex items-start gap-2 text-sm text-ink-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your description is private and used only to match you — never a diagnosis by a
              machine.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex flex-col items-center text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
    </li>
  );
}
