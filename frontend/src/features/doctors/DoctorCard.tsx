import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/Avatar';
import type { PublicDoctor } from './api';

// Shared directory card — used by the doctors list and the AI recommendation
// results so both surfaces render a doctor identically and link into the same
// profile + booking flow. On /recommend a server-written `reason` is passed and
// replaces the bio with a "Why this match" line; the list omits it and shows bio.
export function DoctorCard({ doctor, reason }: { doctor: PublicDoctor; reason?: string }) {
  const hasExperience =
    doctor.yearsOfExperience !== null && doctor.yearsOfExperience !== undefined;
  return (
    <Link to={`/doctors/${doctor.id}`} className="group block h-full">
      <Card className="h-full shadow-xs transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-ai-glow group-hover:shadow-sm">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={doctor.name} photoUrl={doctor.profilePictureUrl} size={54} />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-tight tracking-tight">{doctor.name}</h2>
              {doctor.specializationLabel && (
                <Badge className="mt-1.5 rounded-full border-primary-tint-md">
                  {doctor.specializationLabel}
                </Badge>
              )}
            </div>
          </div>

          {reason ? (
            <div>
              <span className="block text-[11px] font-semibold tracking-wide text-ink-muted">
                Why this match
              </span>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{reason}</p>
            </div>
          ) : (
            doctor.bio && <p className="line-clamp-3 text-sm text-ink-muted">{doctor.bio}</p>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
            <span className="tabular text-sm font-medium text-ink">
              {hasExperience ? `${doctor.yearsOfExperience} years experience` : ''}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              See availability
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
