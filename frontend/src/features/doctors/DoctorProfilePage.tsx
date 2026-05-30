import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Stethoscope, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { AvailabilityCard } from '@/features/booking/AvailabilityCard';
import { useDoctor } from './api';

export function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, error, isError } = useDoctor(id);

  if (isPending) {
    return (
      <main className="container mx-auto flex justify-center px-4 py-20">
        <CrescentSpinner size={64} />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Doctor not found</h1>
        <p className="mt-2 text-ink-muted">
          {error?.message ?? "We couldn't find that profile."}
        </p>
        <Button asChild className="mt-6">
          <Link to="/doctors">Back to all doctors</Link>
        </Button>
      </main>
    );
  }

  const hasExperience =
    data.yearsOfExperience !== null && data.yearsOfExperience !== undefined;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,#F0F4FA_0%,#F7F9FC_30%,#FFFFFF_100%)]">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <Link
          to="/doctors"
          className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse doctors
        </Link>

        {/* minmax(0,…) on the right column stops the availability card's wide
            content (day strip + slot grid) from overflowing its track and
            collapsing the profile card — which was squeezing the name onto two
            lines. The left card keeps a comfortable floor. */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1.35fr)] lg:items-start">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-xs sm:p-8">
          {/* Identity stacks top-to-bottom — the card sits in the narrower left
              rail of the two-column layout, so a side-by-side avatar/name crowds
              and wraps the name awkwardly. */}
          <header className="flex flex-col items-center gap-4 text-center">
            <Avatar name={data.name} photoUrl={data.profilePictureUrl} size={88} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-primary-800">
                {data.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                {data.specializationLabel && (
                  <span className="inline-flex items-center rounded-full border border-primary-tint-md bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
                    {data.specializationLabel}
                  </span>
                )}
                {hasExperience && (
                  <span className="tabular text-sm font-medium text-ink">
                    {data.yearsOfExperience} years of experience
                  </span>
                )}
              </div>
            </div>
          </header>

          {data.bio && (
            <p className="mt-6 border-t border-line pt-6 leading-relaxed text-ink">{data.bio}</p>
          )}

          {/* At-a-glance facts — the consult model, honestly stated. Stacked, as
              the profile now sits in the narrower left rail of the two-column view. */}
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-line pt-6">
            <Fact
              icon={<Stethoscope className="h-4 w-4" />}
              label="Focus"
              value={data.specializationLabel ?? 'General care'}
            />
            <Fact icon={<Video className="h-4 w-4" />} label="Consults by" value="Secure video" />
            <Fact icon={<Clock className="h-4 w-4" />} label="Typical visit" value="~30 minutes" />
          </div>
        </section>

        <div className="lg:sticky lg:top-6">
          <AvailabilityCard
            doctorProfileId={data.id}
            doctorUserId={data.userId}
            doctorName={data.name}
            specializationLabel={data.specializationLabel}
          />
        </div>
        </div>
      </div>
    </main>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface-raised px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
