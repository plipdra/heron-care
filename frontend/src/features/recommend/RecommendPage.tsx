import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, Shield, TriangleAlert } from 'lucide-react';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { DoctorCard } from '@/features/doctors/DoctorCard';
import { useRecommend } from './api';
import { specialtySubcopy } from './specialtyBlurbs';

// Quick-pick chips seeded from the browse-page common concerns; tapping one
// appends to the free text, so the empty box is never intimidating.
const CONCERN_CHIPS = [
  'Headaches',
  'Chest pain',
  'Anxiety or low mood',
  'Skin rash',
  'Joint pain',
  'Stomach issues',
];

// Honesty chip — reinforced even inside the bold header (light variant).
function NotADiagnosisChip({ light = false }: { light?: boolean }) {
  if (light) {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Not a diagnosis
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Not a diagnosis — a pointer to the right care
    </span>
  );
}

// Status copy advances once (~1.15s) while the request is in flight, so the wait
// reads as work happening rather than a frozen spinner.
function ThinkingStatus() {
  const stages = ['Reading what you shared…', 'Finding the right specialists for you…'];
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStage(1), 1150);
    return () => clearTimeout(t);
  }, []);
  return (
    <span key={stage} className="animate-fade-in text-sm font-semibold text-white/95">
      {stages[stage]}
    </span>
  );
}

// Low-opacity white crescent watermark — the brand's richness motif in the
// top-right corner of the blue header (BRAND.md §7).
function HeaderWatermark() {
  return (
    <img
      src="/brand/crescent-white.svg"
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 opacity-[0.09]"
    />
  );
}

// The AI recommendation flow: describe a concern → calm loading → a suggested
// specialty + bookable doctors (or a calm safety notice for red-flag input).
// Guest-accessible; auth is asked only later, at the booking tap. Reuses the
// shared DoctorCard and hands off to the existing profile/slot flow by link.
export function RecommendPage() {
  const recommend = useRecommend();
  const location = useLocation();
  const [concern, setConcern] = useState('');
  const [concernError, setConcernError] = useState<string | null>(null);
  const result = recommend.data;

  // Handoff from the homepage hero: if a concern was carried in via navigation
  // state, prefill it and run the recommendation immediately. The homepage already
  // gates on the 10 non-whitespace character minimum, so any value arriving here
  // is long enough — no second validation needed on this path. Runs once on mount.
  useEffect(() => {
    const initial = (location.state as { concern?: string } | null)?.concern?.trim();
    if (initial) {
      setConcern(initial);
      recommend.mutate({ concern: initial });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addChip(chip: string) {
    setConcern((prev) => {
      if (prev.toLowerCase().includes(chip.toLowerCase())) return prev;
      return prev ? `${prev}, ${chip}` : chip;
    });
  }

  function submit() {
    const trimmed = concern.trim();
    if (!trimmed) {
      setConcernError('Type a word or two about what is going on.');
      return;
    }
    setConcernError(null);
    recommend.mutate({ concern: trimmed });
  }

  const showIntake = !result && !recommend.isPending;

  return (
    // Barely-there tonal wash (design handoff §6) — not a mesh. The page owns its
    // own background; the app shell stays flat.
    <main className="min-h-full bg-[linear-gradient(180deg,#EEF3FB_0%,#F7F9FC_40%,#FFFFFF_100%)]">
      <div className="container mx-auto max-w-[940px] px-4 py-12">
        {showIntake && (
          <>
            <header>
              <h1 className="text-[34px] font-bold leading-tight tracking-tight text-ink">
                Not sure who to see?
              </h1>
              <p className="mt-2 text-base text-ink-muted">
                Tell us what's going on and we'll point you toward the right specialist.
              </p>
            </header>

            {/* The AI entry point, deliberately given visual weight: ai-surface
                gradient + ai-glow border + shadow-ai + a faint crescent watermark. */}
            <div className="relative mt-8 overflow-hidden rounded-lg border border-ai-glow bg-[linear-gradient(180deg,#EEF3FB_0%,#F4F7FB_46%,#FFFFFF_100%)] p-7 shadow-ai">
              <img
                src="/brand/crescent-blue.svg"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-11 -top-12 h-52 w-52 opacity-[0.06]"
              />
              <div className="relative flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <label htmlFor="concern" className="text-sm font-semibold text-ink">
                    What's going on?
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-ink-muted" />
                    <textarea
                      id="concern"
                      autoFocus
                      rows={4}
                      maxLength={1000}
                      value={concern}
                      onChange={(e) => {
                        setConcern(e.target.value);
                        if (concernError) setConcernError(null);
                      }}
                      aria-invalid={concernError ? true : undefined}
                      aria-describedby={concernError ? 'concern-error' : undefined}
                      placeholder="A sentence or two is enough — e.g. 'chest tightness when I climb stairs'."
                      className="w-full resize-y rounded-md border border-line bg-surface py-3 pl-10 pr-3.5 text-sm leading-relaxed text-ink shadow-xs transition-all placeholder:text-ink-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-tint"
                    />
                    {concernError && (
                      <p id="concern-error" className="text-sm text-danger">
                        {concernError}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CONCERN_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => addChip(chip)}
                        className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-ai-glow hover:bg-primary-tint-sm"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {recommend.isError && (
                  <p className="text-sm text-danger">
                    {recommend.error instanceof ApiError
                      ? recommend.error.problem?.detail ??
                        'Couldn’t get a recommendation just now. Try again in a moment.'
                      : 'Couldn’t reach the server. Check your connection, then try again.'}
                  </p>
                )}

                <Button
                  size="lg"
                  onClick={submit}
                  disabled={!concern.trim()}
                  className="w-full gap-2 shadow-sm"
                >
                  Find the right doctor
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-xs leading-relaxed text-ink-muted">
                  This helps match you to a specialist. It isn't a diagnosis or medical advice, and
                  your description is processed by an AI service.
                </p>
              </div>
            </div>
          </>
        )}

        {recommend.isPending && (
          <div
            className="animate-slide-up overflow-hidden rounded-lg border border-ai-glow shadow-ai"
            role="status"
            aria-live="polite"
          >
            {/* Header bar deepens toward its final blue as the answer nears: a
                lighter-blue veil fades out over the deep-blue base. */}
            <div className="relative overflow-hidden bg-[linear-gradient(180deg,var(--primary)_0%,var(--primary-hover)_100%)] px-8 py-7">
              <div className="animate-veil-fade pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#2E6AB6_0%,#1E5398_100%)]" />
              <HeaderWatermark />
              <div className="relative flex flex-col gap-3">
                <div className="flex items-center gap-3.5">
                  <CrescentSpinner size={40} variant="white" pulse />
                  <ThinkingStatus />
                </div>
                {/* Shimmer bar where the suggestion will land (brand-tinted, light). */}
                <div className="h-7 w-1/2 overflow-hidden rounded-md bg-white/15">
                  <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0)_100%)] bg-[length:400px_100%]" />
                </div>
                <NotADiagnosisChip light />
              </div>
            </div>
            <div className="grid gap-4 bg-[linear-gradient(180deg,var(--ai-surface)_0%,#FFFFFF_100%)] p-8 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        )}

        {result && !recommend.isPending && (
          <div aria-live="polite">
            {result.urgent ? (
              <div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-line bg-surface p-7 shadow-md">
                <img
                  src="/brand/crescent-blue.svg"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 opacity-[0.05]"
                />
                <div className="relative flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(199,125,82,0.1)] text-warning">
                    <TriangleAlert className="h-5 w-5" />
                  </span>
                  <div className="flex flex-col gap-2.5">
                    <h1 className="text-lg font-bold tracking-tight text-ink">
                      If this is an emergency
                    </h1>
                    <p className="text-[15px] leading-relaxed text-ink">{result.notice}</p>
                    <Button asChild variant="secondary" className="mt-2 self-start">
                      <Link to="/doctors">Browse all doctors</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-slide-up overflow-hidden rounded-lg border border-ai-glow shadow-ai">
                {/* Confident header — the suggestion is the page's single most
                    authoritative element, in white on the brand blue. */}
                <div className="relative overflow-hidden bg-[linear-gradient(180deg,var(--primary)_0%,var(--primary-hover)_100%)] px-8 py-7">
                  <HeaderWatermark />
                  <div className="relative flex max-w-[80%] flex-col gap-2.5">
                    <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
                      {result.suggestedSpecializationLabel
                        ? `We suggest ${result.suggestedSpecializationLabel}.`
                        : "Here's who we'd suggest."}
                    </h1>
                    <p className="text-[15px] leading-relaxed text-white/85">
                      {specialtySubcopy(result.suggestedSpecializationLabel)}
                    </p>
                    <div className="mt-1">
                      <NotADiagnosisChip light />
                    </div>
                  </div>
                </div>

                <div className="bg-[linear-gradient(180deg,var(--ai-surface)_0%,#FFFFFF_100%)] p-8">
                  {result.doctors.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {result.doctors.map((r, i) => (
                        <div
                          key={r.doctor.id}
                          className="animate-stagger-in"
                          style={{ animationDelay: `${i * 70}ms` }}
                        >
                          <DoctorCard doctor={r.doctor} reason={r.reason} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      No doctors match these symptoms right now. Try describing your concern
                      in broader terms, or{' '}
                      <Link to="/doctors" className="text-primary hover:underline">
                        browse all specialists
                      </Link>{' '}
                      to find someone directly.
                    </p>
                  )}

                  <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-line pt-5">
                    <button
                      type="button"
                      onClick={() => recommend.reset()}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Start over
                    </button>
                    <p className="flex min-w-[220px] flex-1 items-start gap-2 text-xs leading-relaxed text-ink-muted">
                      <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      Heron's suggestions are a starting point, not a diagnosis. For emergencies,
                      contact your local emergency services.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Brand-tinted skeleton (never gray) matching the doctor card's layout, so there
// is no size jump when the real cards slide in.
function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <Shimmer className="h-[54px] w-[54px] rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Shimmer className="h-4 w-3/5 rounded" />
          <Shimmer className="h-[18px] w-2/5 rounded-full" />
        </div>
      </div>
      <Shimmer className="h-2.5 w-1/3 rounded" />
      <Shimmer className="h-3 w-full rounded" />
      <Shimmer className="h-3 w-3/4 rounded" />
      <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
        <Shimmer className="h-3 w-1/3 rounded" />
        <Shimmer className="h-3 w-1/4 rounded" />
      </div>
    </div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`overflow-hidden bg-primary-tint-sm ${className ?? ''}`}>
      <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,rgba(205,217,237,0)_0%,rgba(205,217,237,0.55)_50%,rgba(205,217,237,0)_100%)] bg-[length:400px_100%]" />
    </div>
  );
}
