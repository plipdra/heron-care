import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { cn } from '@/lib/utils';
import { SPECIALIZATIONS, type Specialization } from './specializations';
import { DoctorCard } from './DoctorCard';
import { useDoctors } from './api';

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function DoctorsListPage() {
  const [specialization, setSpecialization] = useState<Specialization | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const search = useDebounce(searchInput, 300);

  const { data, isPending, error, isError } = useDoctors({
    specialization,
    search,
    page,
  });

  useEffect(() => {
    setPage(0);
  }, [specialization, search]);

  return (
    <main className="container mx-auto px-4 py-10">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Find a doctor</h1>
        <p className="mt-2 text-ink-muted">
          Browse specialists, or filter by what you need. No account required.
        </p>
      </header>

      {/* The one symptom→specialty path: describe it and the AI router suggests a specialist. */}
      <Link
        to="/recommend"
        className="group mt-8 flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-6 transition-colors hover:border-primary"
      >
        <div>
          <p className="text-lg font-semibold text-ink">Not sure who to see?</p>
          <p className="mt-1 text-sm text-ink-muted">
            Describe what's going on and we'll suggest the right specialist.
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-primary group-hover:underline">
          Get a recommendation →
        </span>
      </Link>

      {/* Filter band: search + an always-visible specialty pill set, laid out as an
          even full-width grid (council verdict 5-1 over a scroll rail / natural wrap).
          The grid fills the same width as the search above and the card grid below,
          so the row reads as deliberate structure rather than chips that happened to
          wrap — it kills both the lone-orphan pill and the right-side void a width-cap
          left behind. Column counts are chosen so 11 pills never leave a single chip
          alone on the last row (11 mod cols is 2 or 3 at every breakpoint, never 1);
          the only gap is at most one empty trailing cell, which is invisible. Pills
          stay calm: quiet at rest, soft primary-tint when active. All visible, no
          "+ more" overflow — hiding a specialty reintroduces "is mine buried?". */}
      <section className="mt-8 flex flex-col gap-4">
        <Input
          type="search"
          placeholder="Search by name or specialty (e.g. Reyes, cardiology)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <button
            type="button"
            aria-pressed={specialization === null}
            onClick={() => setSpecialization(null)}
            className={cn(
              'flex min-h-[40px] w-full items-center justify-center rounded-md border px-3 py-1.5 text-center text-sm transition-colors',
              specialization === null
                ? 'border-primary bg-primary-tint font-medium text-primary'
                : 'border-line text-ink hover:border-primary',
            )}
          >
            All specialties
          </button>
          {SPECIALIZATIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={specialization === s.value}
              onClick={() => setSpecialization(s.value)}
              className={cn(
                'flex min-h-[40px] w-full items-center justify-center rounded-md border px-3 py-1.5 text-center text-sm transition-colors',
                specialization === s.value
                  ? 'border-primary bg-primary-tint font-medium text-primary'
                  : 'border-line text-ink hover:border-primary',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        {isPending && (
          <div className="flex justify-center py-12">
            <CrescentSpinner size={64} />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-line bg-surface p-6 text-center">
            <p className="text-sm text-ink-muted">
              Couldn't load doctors right now. {error?.message}
            </p>
          </div>
        )}

        {data && data.content.length === 0 && (
          <div className="rounded-lg border border-line bg-surface p-10 text-center">
            <p className="text-lg font-medium">No doctors match your filters.</p>
            <p className="mt-2 text-ink-muted">
              Try a broader search, or describe what's going on and we'll help.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setSpecialization(null);
                  setSearchInput('');
                }}
              >
                Show all doctors
              </Button>
              <Button asChild variant="ghost">
                <Link to="/recommend">Describe your symptoms →</Link>
              </Button>
            </div>
          </div>
        )}

        {data && data.content.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.content.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-ink-muted tabular">
              Page {data.page + 1} of {data.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
              disabled={page >= data.totalPages - 1}
            >
              Next
            </Button>
          </nav>
        )}
      </section>
    </main>
  );
}
