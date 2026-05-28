import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/Avatar';
import type { PublicDoctor } from './api';

// Shared directory card — used by the doctors list and the AI recommendation
// results so both surfaces render a doctor identically and link into the same
// profile + booking flow.
export function DoctorCard({ doctor }: { doctor: PublicDoctor }) {
  return (
    <Link to={`/doctors/${doctor.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary">
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-start gap-4">
            <Avatar name={doctor.name} size={48} />
            <div className="flex-1">
              <h2 className="text-lg font-semibold leading-tight">{doctor.name}</h2>
              {doctor.specializationLabel && (
                <Badge className="mt-2">{doctor.specializationLabel}</Badge>
              )}
            </div>
          </div>
          {doctor.bio && (
            <p className="line-clamp-3 text-sm text-ink-muted">{doctor.bio}</p>
          )}
          {doctor.yearsOfExperience !== null && doctor.yearsOfExperience !== undefined && (
            <p className="tabular text-xs text-ink-muted">
              {doctor.yearsOfExperience} years of experience
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
