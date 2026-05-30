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
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/doctors"
          className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all doctors
        </Link>

        <section className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-xs sm:p-8">
          <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Avatar name={data.name} photoUrl={data.profilePictureUrl} size={84} />
            <div className="flex-1">
              <h1 className="text-3xl font-semibold tracking-tight text-primary-800">
                {data.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
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
            <p className="mt-6 leading-relaxed text-ink">{data.bio}</p>
          )}

          {/* At-a-glance facts — the consult model, honestly stated. */}
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-3">
            <Fact
              icon={<Stethoscope className="h-4 w-4" />}
              label="Focus"
              value={data.specializationLabel ?? 'General care'}
            />
            <Fact icon={<Video className="h-4 w-4" />} label="Consults by" value="Secure video" />
            <Fact icon={<Clock className="h-4 w-4" />} label="Typical visit" value="~30 minutes" />
          </div>
        </section>

        <AvailabilityCard
          doctorProfileId={data.id}
          doctorUserId={data.userId}
          doctorName={data.name}
          specializationLabel={data.specializationLabel}
        />
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
