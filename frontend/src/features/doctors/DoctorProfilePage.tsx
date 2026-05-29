import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
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

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <Link to="/doctors" className="text-sm text-ink-muted hover:text-primary">
        ← Back to all doctors
      </Link>

      <header className="mt-6 flex items-start gap-5">
        <Avatar name={data.name} photoUrl={data.profilePictureUrl} size={80} />
        <div className="flex-1">
          <h1 className="text-4xl font-semibold tracking-tight">{data.name}</h1>
          {data.specializationLabel && (
            <Badge className="mt-3">{data.specializationLabel}</Badge>
          )}
          {data.yearsOfExperience !== null &&
            data.yearsOfExperience !== undefined && (
              <p className="mt-3 text-sm text-ink-muted tabular">
                {data.yearsOfExperience} years of experience
              </p>
            )}
        </div>
      </header>

      {data.bio && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">About</h2>
          <p className="mt-3 text-ink">{data.bio}</p>
        </section>
      )}

      <AvailabilityCard
        doctorProfileId={data.id}
        doctorUserId={data.userId}
        doctorName={data.name}
        specializationLabel={data.specializationLabel}
      />
    </main>
  );
}
