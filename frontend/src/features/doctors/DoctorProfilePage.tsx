import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { useDoctor } from './api';

export function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, error, isError } = useDoctor(id);

  if (isPending) {
    return (
      <main className="container mx-auto flex justify-center px-4 py-20">
        <CrescentSpinner size={32} />
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

      <header className="mt-6">
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
      </header>

      {data.bio && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">About</h2>
          <p className="mt-3 text-ink">{data.bio}</p>
        </section>
      )}

      <Card className="mt-10">
        <CardContent className="flex flex-col gap-3 p-6 text-center">
          <h2 className="text-lg font-semibold">Availability</h2>
          <p className="text-sm text-ink-muted">
            Slot booking arrives in the next iteration.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
