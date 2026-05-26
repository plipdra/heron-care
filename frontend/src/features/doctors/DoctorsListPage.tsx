import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import {
  SPECIALIZATIONS,
  specializationLabel,
  type Specialization,
} from './specializations';
import { useDoctors, type PublicDoctor } from './api';

// Symptom vocabulary → specialty bridge for the marketplace browse flow.
// The spec calls this out: discovery should map medical-need language onto
// the directory. First entry in `specs` is applied on click; the rest
// render in copy so the user knows the alternative exists.
const COMMON_CONCERNS: { label: string; specs: Specialization[] }[] = [
  { label: 'Headaches', specs: ['INTERNAL_MEDICINE', 'NEUROLOGY'] },
  { label: 'Chest pain', specs: ['CARDIOLOGY'] },
  { label: 'Anxiety, low mood', specs: ['PSYCHIATRY'] },
  { label: 'Skin rash, acne', specs: ['DERMATOLOGY'] },
  { label: 'Pediatric concerns', specs: ['PEDIATRICS'] },
];

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
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Find a doctor
        </h1>
        <p className="mt-2 text-ink-muted">
          Browse specialists, or filter by what you need. No account required.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-4">
        <details className="rounded-md border border-line bg-surface px-4 py-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Common concerns
          </summary>
          <p className="mt-2 text-xs text-ink-muted">
            Tap to filter by specialty.
          </p>
          <div className="mt-2">
            <CommonConcernsList onPick={setSpecialization} />
          </div>
        </details>

        <aside className="hidden lg:col-span-1 lg:block">
          <h2 className="text-sm font-semibold text-ink">Common concerns</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Tap to filter by specialty.
          </p>
          <div className="mt-3">
            <CommonConcernsList onPick={setSpecialization} />
          </div>
        </aside>

        <div className="lg:col-span-3">
          <section className="flex flex-col gap-4">
            <Input
              type="search"
              placeholder="Search by name or condition (e.g. eczema, hypertension)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSpecialization(null)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  specialization === null
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-line text-ink hover:border-primary'
                }`}
              >
                All specialties
              </button>
              {SPECIALIZATIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSpecialization(s.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    specialization === s.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-line text-ink hover:border-primary'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-10">
            {isPending && (
              <div className="flex justify-center py-12">
                <CrescentSpinner size={32} />
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
                <p className="text-lg font-medium">No doctors match these filters.</p>
                <p className="mt-2 text-ink-muted">
                  Try broader terms or browse all specialists.
                </p>
              </div>
            )}

            {data && data.content.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        </div>
      </div>
    </main>
  );
}

function CommonConcernsList({
  onPick,
}: {
  onPick: (spec: Specialization) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {COMMON_CONCERNS.map((c) => (
        <li key={c.label}>
          <button
            type="button"
            onClick={() => onPick(c.specs[0])}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-bg"
          >
            <span className="block font-medium text-ink">{c.label}</span>
            <span className="block text-xs text-ink-muted">
              {c.specs.map((s) => specializationLabel(s) ?? s).join(' or ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DoctorCard({ doctor }: { doctor: PublicDoctor }) {
  return (
    <Link to={`/doctors/${doctor.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary">
        <CardContent className="flex flex-col gap-3 p-6">
          <div>
            <h2 className="text-lg font-semibold leading-tight">{doctor.name}</h2>
            {doctor.specializationLabel && (
              <Badge className="mt-2">{doctor.specializationLabel}</Badge>
            )}
          </div>
          {doctor.bio && (
            <p className="line-clamp-3 text-sm text-ink-muted">{doctor.bio}</p>
          )}
          {doctor.yearsOfExperience !== null &&
            doctor.yearsOfExperience !== undefined && (
              <p className="text-xs text-ink-muted tabular">
                {doctor.yearsOfExperience} years of experience
              </p>
            )}
        </CardContent>
      </Card>
    </Link>
  );
}
