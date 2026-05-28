import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { DoctorCard } from '@/features/doctors/DoctorCard';
import { useRecommend } from './api';

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

// The AI recommendation flow: describe a concern → calm loading → a suggested
// specialty + bookable doctors (or a calm safety notice for red-flag input).
// Guest-accessible; auth is asked only later, at the booking tap. Reuses the
// shared DoctorCard and hands off to the existing profile/slot flow by link.
export function RecommendPage() {
  const recommend = useRecommend();
  const location = useLocation();
  const [concern, setConcern] = useState('');
  const result = recommend.data;

  // Handoff from the homepage hero: if a concern was carried in via navigation
  // state, prefill it and run the recommendation immediately. Runs once on mount.
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
    if (trimmed) recommend.mutate({ concern: trimmed });
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      {!result && !recommend.isPending && (
        <>
          <header>
            <h1 className="text-3xl font-semibold tracking-tight">Not sure who to see?</h1>
            <p className="mt-2 text-ink-muted">
              Tell us what's going on and we'll point you toward the right specialist.
            </p>
          </header>

          <div className="mt-8 flex flex-col gap-4">
            <label htmlFor="concern" className="text-sm font-medium text-ink">
              What's going on?
            </label>
            <textarea
              id="concern"
              autoFocus
              rows={4}
              maxLength={1000}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="A sentence or two is enough — e.g. 'chest tightness when I climb stairs'."
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            />
            <div className="flex flex-wrap gap-2">
              {CONCERN_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => addChip(chip)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-primary"
                >
                  {chip}
                </button>
              ))}
            </div>

            {recommend.isError && (
              <p className="text-sm text-danger">
                {recommend.error instanceof ApiError
                  ? recommend.error.problem?.detail ?? 'Something went wrong. Please try again.'
                  : 'Couldn’t reach the server. Please try again.'}
              </p>
            )}

            <Button onClick={submit} disabled={!concern.trim()}>
              Find the right doctor
            </Button>
            <p className="text-xs text-ink-muted">
              This helps match you to a specialist. It isn't a diagnosis or medical advice, and your
              description is processed by an AI service.
            </p>
          </div>
        </>
      )}

      {recommend.isPending && (
        <div className="flex flex-col items-center gap-4 py-20" role="status" aria-live="polite">
          <CrescentSpinner size={56} />
          <p className="text-sm text-ink-muted">Finding the right specialists for you…</p>
        </div>
      )}

      {result && !recommend.isPending && (
        <div aria-live="polite">
          {result.urgent ? (
            <div className="rounded-lg border border-line bg-surface p-6">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <h1 className="text-lg font-semibold text-ink">If this is an emergency</h1>
                  <p className="mt-2 text-sm text-ink">{result.notice}</p>
                </div>
              </div>
              <Button asChild variant="secondary" className="mt-6">
                <Link to="/doctors">Browse all doctors</Link>
              </Button>
            </div>
          ) : (
            <>
              <header>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Based on what you've shared, these specialists are most likely a fit.
                </h1>
                {result.suggestedSpecializationLabel && result.doctors[0] && (
                  <p className="mt-4 rounded-md bg-primary-tint px-4 py-3 text-sm text-ink">
                    <span className="font-semibold text-primary">
                      We suggest {result.suggestedSpecializationLabel}.
                    </span>{' '}
                    {result.doctors[0].reason}
                  </p>
                )}
              </header>

              {result.doctors.length > 0 ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {result.doctors.map((r) => (
                    <DoctorCard key={r.doctor.id} doctor={r.doctor} />
                  ))}
                </div>
              ) : (
                <p className="mt-8 text-sm text-ink-muted">
                  No doctors are available right now.{' '}
                  <Link to="/doctors" className="text-primary hover:underline">
                    Browse all specialists
                  </Link>
                  .
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
                <button
                  type="button"
                  onClick={() => recommend.reset()}
                  className="self-start text-sm text-primary hover:underline"
                >
                  ← Start over
                </button>
                <p className="text-xs text-ink-muted">
                  Heron's suggestions are a starting point, not a diagnosis. For emergencies, contact
                  your local emergency services.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
