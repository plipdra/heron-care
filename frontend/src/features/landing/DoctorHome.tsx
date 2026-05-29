import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardList, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { formatFullDateTime, formatTime } from '@/lib/datetime';
import { useMyDoctorProfile } from '@/features/doctors/api';
import { useDoctorBookings, type DoctorBooking } from '@/features/booking/api';
import { displayStatus, StatusPill } from '@/features/booking/status';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string | null | undefined): string {
  if (!name) return 'Doctor';
  return name.replace(/^Dr\.?\s+/i, '').split(/[\s,]+/)[0] || 'Doctor';
}

function sameLocalDay(iso: string, now: number): boolean {
  return new Date(iso).toDateString() === new Date(now).toDateString();
}

// A logged-in doctor's home: a calm dashboard over their consults. Counts are
// derived client-side from the already-loaded booking list (no extra endpoint) —
// today's and the week's confirmed consults, and how many elapsed visits still
// need notes. Leads with the next consult so the first glance is actionable.
export function DoctorHome() {
  const { data: profile } = useMyDoctorProfile();
  const { data, isPending } = useDoctorBookings();
  const now = Date.now();

  const stats = useMemo(() => {
    const bookings = data?.content ?? [];
    const upcoming = bookings
      .filter((b) => displayStatus(b, now) === 'upcoming')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const today = upcoming.filter((b) => sameLocalDay(b.startsAt, now));
    const week = upcoming.filter((b) => {
      const t = new Date(b.startsAt).getTime();
      return t >= now && t <= now + 7 * 86_400_000;
    });
    const pendingNotes = bookings.filter((b) => displayStatus(b, now) === 'ended').length;
    return { upcoming, today, week, pendingNotes, nextUp: upcoming[0] ?? null };
  }, [data, now]);

  const hour = new Date(now).getHours();

  return (
    <main className="relative overflow-hidden bg-[linear-gradient(180deg,#EEF3FB_0%,#F7F9FC_38%,#FFFFFF_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-28 hidden h-[760px] w-[760px] opacity-[0.10] md:block"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="container mx-auto max-w-5xl px-4 py-14 md:py-16">
        <header className="max-w-2xl">
          <p className="text-sm font-medium text-ink-muted">{greeting(hour)},</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-primary-800 md:text-5xl">
            Dr. {firstName(profile?.name)}
          </h1>
          <p className="mt-3 text-lg text-ink-muted">
            Your consults and each patient's context, a click away.
          </p>
        </header>

        {isPending ? (
          <div className="flex justify-center py-16">
            <CrescentSpinner size={48} />
          </div>
        ) : (
          <>
            {/* Next up — the soonest confirmed consult, lifted to the top. */}
            {stats.nextUp && <NextUpCard booking={stats.nextUp} />}

            {/* Stat tiles, derived from the booking list. */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat
                icon={<CalendarDays className="h-4 w-4" />}
                value={stats.today.length}
                label="Consults today"
              />
              <Stat
                icon={<Video className="h-4 w-4" />}
                value={stats.week.length}
                label="This week"
              />
              <Stat
                icon={<ClipboardList className="h-4 w-4" />}
                value={stats.pendingNotes}
                label="Pending notes"
              />
            </div>

            {/* Schedule preview. */}
            <section className="mt-8 rounded-lg border border-line bg-surface p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">Coming up</h2>
                <Link
                  to="/appointments"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  All consults
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {stats.upcoming.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  No upcoming consults. Your published hours decide when patients can book —
                  <Link to="/profile" className="ml-1 font-medium text-primary hover:underline">
                    review your availability
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {stats.upcoming.slice(0, 5).map((b) => (
                    <li key={b.id} className="flex items-center gap-3 py-3">
                      <Avatar name={b.patientName ?? 'Patient'} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {b.patientName ?? 'Patient'}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {b.concernNote ?? 'No note added.'}
                        </p>
                      </div>
                      <span className="tabular hidden text-sm text-ink-muted sm:block">
                        {formatFullDateTime(b.startsAt)}
                      </span>
                      <span className="tabular text-sm font-medium text-ink sm:hidden">
                        {formatTime(b.startsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function NextUpCard({ booking }: { booking: DoctorBooking }) {
  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-ai-glow bg-[linear-gradient(180deg,#EEF3FB_0%,#F4F7FB_60%,#FFFFFF_100%)] p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next up</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={booking.patientName ?? 'Patient'} size={48} />
          <div>
            <p className="text-base font-semibold text-primary-800">
              {booking.patientName ?? 'Patient'}
            </p>
            <p className="tabular text-sm text-ink-muted">{formatFullDateTime(booking.startsAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status="upcoming" />
          {booking.joinable && booking.meetingLink ? (
            <Button asChild className="gap-1.5 shadow-sm">
              <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" />
                Join the consult
              </a>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link to="/appointments">Open</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-xs">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint text-primary">
        {icon}
      </span>
      <p className="mt-3 tabular text-3xl font-bold text-primary-800">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
