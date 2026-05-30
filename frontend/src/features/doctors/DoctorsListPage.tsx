import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Baby,
  Bone,
  Brain,
  Droplet,
  Heart,
  HeartPulse,
  LayoutGrid,
  Search,
  Sparkles,
  Smile,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { cn } from '@/lib/utils';
import { SPECIALIZATIONS, type Specialization } from './specializations';
import { DoctorCard } from './DoctorCard';
import { useDoctors } from './api';

// A calm, recognisable glyph per specialty — orientation, not decoration. Kept
// inside the locked palette (the icon inherits the pill's text colour).
const SPEC_ICON: Record<string, LucideIcon> = {
  GENERAL_PRACTICE: Stethoscope,
  INTERNAL_MEDICINE: Activity,
  PEDIATRICS: Baby,
  OB_GYN: HeartPulse,
  CARDIOLOGY: Heart,
  DERMATOLOGY: Sparkles,
  PSYCHIATRY: Smile,
  NEUROLOGY: Brain,
  ORTHOPEDICS: Bone,
  ENDOCRINOLOGY: Droplet,
};

function SpecPill({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-all duration-150',
        active
          ? 'border-primary bg-primary-tint font-semibold text-primary shadow-xs'
          : 'border-line bg-surface text-ink shadow-xs hover:-translate-y-0.5 hover:border-ai-glow hover:shadow-sm',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-ink-muted')}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

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

      {/* The one symptom→specialty path: describe it and the AI router suggests a
          specialist. Carries the AI-panel treatment (ai-surface + glow + crescent)
          so it reads as the page's most-inviting action. */}
      <Link
        to="/recommend"
        className="group relative mt-8 flex items-center justify-between gap-4 overflow-hidden rounded-lg border border-ai-glow bg-[linear-gradient(180deg,#EEF3FB_0%,#F4F7FB_55%,#FFFFFF_100%)] p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 opacity-[0.08]"
          style={{
            backgroundImage: 'url(/brand/crescent-blue.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="relative flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-lg font-semibold text-primary-800">Not sure who to see?</p>
            <p className="mt-1 text-sm text-ink-muted">
              Describe what's going on and we'll suggest the right specialist.
            </p>
          </div>
        </div>
        <span className="relative inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          Get a recommendation
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          />
          <Input
            type="search"
            placeholder="Search by name or specialty (e.g. Reyes, cardiology)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 shadow-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <SpecPill
            icon={LayoutGrid}
            label="All specialties"
            active={specialization === null}
            onClick={() => setSpecialization(null)}
          />
          {SPECIALIZATIONS.map((s) => (
            <SpecPill
              key={s.value}
              icon={SPEC_ICON[s.value] ?? Stethoscope}
              label={s.label}
              active={specialization === s.value}
              onClick={() => setSpecialization(s.value)}
            />
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
