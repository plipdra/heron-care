import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Copy, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { formatTime } from '@/lib/datetime';
import { useMyDoctorProfile } from '@/features/doctors/api';
import { useDoctorBookings, type DoctorBooking } from '@/features/booking/api';
import { displayStatus } from '@/features/booking/status';

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

// "Today" / "Yesterday" / "Tomorrow" / weekday / date — so a bare time is never
// ambiguous about which day it falls on.
function relativeDay(iso: string, now: number): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (Math.abs(diff) < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// The doctor's home: a calm dashboard over their consults. Counts and the
// schedule are derived client-side from the already-loaded booking list (no extra
// endpoint). The dark navy hero carries the day's shape; the work sits below.
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
    const pending = bookings.filter((b) => displayStatus(b, now) === 'ended');
    // "Live" = the slot actually spanning now (started, not yet ended) — not just
    // any joinable upcoming consult. At most one, since slots never overlap.
    const live =
      today.find((b) => {
        const s = new Date(b.startsAt).getTime();
        return s <= now && new Date(b.endsAt).getTime() > now;
      }) ?? null;
    // Mon-anchored week strip with per-day counts.
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const strip = DAY_LABELS.map((label, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const count = upcoming.filter((b) => sameLocalDay(b.startsAt, day.getTime())).length;
      return {
        label,
        date: day.getDate(),
        count,
        dow: day.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase(),
        isToday: day.toDateString() === new Date(now).toDateString(),
      };
    });
    // Next up = the earliest consult that hasn't started yet (skips the live one).
    const nextUp = upcoming.find((b) => new Date(b.startsAt).getTime() > now) ?? null;
    return { upcoming, today, week, pending, nextUp, live, strip };
  }, [data, now]);

  // Working weekdays from the doctor's schedule — off-days show "Off" in the strip.
  const workingDays = useMemo(
    () => new Set((profile?.availability?.weeklySchedule ?? []).map((e) => e.dayOfWeek)),
    [profile],
  );

  const hour = new Date(now).getHours();
  const dateLabel = new Date(now).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-full bg-bg">
      <div className="container mx-auto max-w-5xl px-4 py-10">
        {/* Dark navy hero — the day's shape at a glance. */}
        <section className="relative overflow-hidden rounded-xl bg-[linear-gradient(160deg,#012050_0%,#023A78_100%)] p-7 text-white shadow-md md:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-10 h-72 w-72 opacity-[0.10]"
            style={{
              backgroundImage: 'url(/brand/crescent-white.svg)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <p className="text-sm font-medium text-white/70">{greeting(hour)}, Dr. {firstName(profile?.name)}.</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{dateLabel}</h1>
          {isPending ? (
            <div className="mt-6 flex py-2">
              <CrescentSpinner size={32} variant="white" />
            </div>
          ) : (
            <>
              <p className="mt-3 max-w-2xl text-white/80">
                You have <span className="font-semibold text-white">{stats.today.length}</span>{' '}
                {stats.today.length === 1 ? 'consult' : 'consults'} today
                {stats.live ? ', one happening now' : ''}, and{' '}
                <span className="font-semibold text-white">{stats.pending.length}</span>{' '}
                {stats.pending.length === 1 ? 'visit' : 'visits'} waiting on notes.
              </p>
              {stats.nextUp && <HeroNextUp booking={stats.nextUp} />}
            </>
          )}
        </section>

        {!isPending && (
          <>
            {/* Stat tiles */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat
                value={stats.today.length}
                label="Today's consults"
                meta={stats.live ? '1 in progress' : undefined}
              />
              <Stat value={stats.week.length} label="This week" meta="next 7 days" />
              <Stat
                value={stats.pending.length}
                label="Pending notes"
                meta={
                  stats.pending.length > 0
                    ? `oldest ${relativeDay(stats.pending[stats.pending.length - 1].startsAt, now)}`
                    : 'all caught up'
                }
              />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {/* Today's schedule */}
              <section className="rounded-lg border border-line bg-surface p-6 shadow-xs lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ink">Today's schedule</h2>
                  <Link
                    to="/appointments"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    All consults
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {stats.today.length > 0 ? (
                  <ul className="mt-4 divide-y divide-line">
                    {stats.today.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 py-3">
                        <span className="w-16 shrink-0">
                          <span className="tabular block text-sm font-bold text-primary-800">
                            {formatTime(b.startsAt)}
                          </span>
                          <span className="block text-[11px] text-ink-muted">30 min</span>
                        </span>
                        <Avatar name={b.patientName ?? 'Patient'} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {b.patientName ?? 'Patient'}
                          </p>
                          <p className="truncate text-xs text-ink-muted">
                            {b.concernNote ?? 'No note added.'}
                          </p>
                        </div>
                        {stats.live?.id === b.id ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-care-line bg-care-tint px-2.5 py-0.5 text-[11px] font-semibold text-care">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-care" />
                            In&nbsp;progress
                          </span>
                        ) : stats.nextUp?.id === b.id ? (
                          <span className="shrink-0 rounded-full border border-line bg-surface-raised px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                            Next up
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-ink-muted">No consults today. Enjoy the quiet.</p>
                )}
              </section>

              {/* Waiting on notes + meeting room */}
              <div className="flex flex-col gap-5">
                <section className="rounded-lg border border-line bg-surface p-6 shadow-xs">
                  <h2 className="text-base font-semibold text-ink">Waiting on notes</h2>
                  {stats.pending.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-3">
                      {stats.pending.slice(0, 4).map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {b.patientName ?? 'Patient'}
                            </p>
                            <p className="tabular truncate text-xs text-ink-muted">
                              {relativeDay(b.startsAt, now)} · {formatTime(b.startsAt)}
                            </p>
                          </div>
                          <Button asChild size="sm" variant="secondary" className="shrink-0">
                            <Link to="/appointments">Write</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-ink-muted">All notes are up to date.</p>
                  )}
                </section>

                {profile?.defaultMeetingLink && (
                  <section className="relative overflow-hidden rounded-lg border border-line bg-[#F0F4FA] p-6 shadow-xs">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 opacity-[0.07]"
                      style={{
                        backgroundImage: 'url(/brand/crescent-blue.svg)',
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                    <p className="relative text-[11px] font-bold uppercase tracking-wide text-primary">
                      Your meeting room
                    </p>
                    <h3 className="relative mt-1.5 text-base font-bold tracking-tight text-ink">
                      One room for every visit
                    </h3>
                    <p className="relative mt-1.5 text-sm leading-relaxed text-ink-muted">
                      Patients get this link automatically an hour before each booked visit.
                    </p>
                    <div className="relative mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5">
                      <Video className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm text-ink">{profile.defaultMeetingLink}</span>
                      <button
                        type="button"
                        aria-label="Copy meeting link"
                        onClick={() => navigator.clipboard?.writeText(profile.defaultMeetingLink ?? '')}
                        className="ml-auto shrink-0 text-ink-muted hover:text-primary"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <Link
                      to="/profile"
                      className="relative mt-3 inline-block rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
                    >
                      Change in profile
                    </Link>
                  </section>
                )}
              </div>
            </div>

            {/* Week strip */}
            <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">This week</h2>
                <Link
                  to="/appointments"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Open week view →
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {stats.strip.map((d) => {
                  const off = workingDays.size > 0 && !workingDays.has(d.dow);
                  return (
                    <div
                      key={d.label}
                      className={`flex flex-col items-center rounded-md border py-2 ${
                        d.isToday
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-line bg-surface'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-medium uppercase ${d.isToday ? 'text-primary-foreground/80' : 'text-ink-muted'}`}
                      >
                        {d.label}
                      </span>
                      <span
                        className={`tabular text-base font-semibold ${d.isToday ? 'text-primary-foreground' : 'text-ink'}`}
                      >
                        {d.date}
                      </span>
                      <span
                        className={`text-[11px] ${d.isToday ? 'text-primary-foreground/80' : 'text-ink-muted'}`}
                      >
                        {off ? 'Off' : d.count > 0 ? `${d.count} consult${d.count > 1 ? 's' : ''}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function HeroNextUp({ booking }: { booking: DoctorBooking }) {
  const mins = Math.round((new Date(booking.startsAt).getTime() - Date.now()) / 60_000);
  const rel = mins <= 0 ? 'Now' : mins < 60 ? `In ${mins} min` : `In ${Math.round(mins / 60)} h`;
  return (
    <div className="mt-6 flex flex-col gap-4 rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Avatar name={booking.patientName ?? 'Patient'} size={44} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Next up</p>
          <p className="font-semibold text-white">{booking.patientName ?? 'Patient'}</p>
          <p className="tabular text-sm text-white/70">
            {rel} · {formatTime(booking.startsAt)}
          </p>
        </div>
      </div>
      {booking.joinable && booking.meetingLink ? (
        <Button
          asChild
          variant="secondary"
          className="gap-1.5 border-0 bg-white text-primary-800 hover:bg-white/90"
        >
          <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4" />
            Open meeting room
          </a>
        </Button>
      ) : (
        <Button
          asChild
          variant="secondary"
          className="border-0 bg-white/15 text-white hover:bg-white/25"
        >
          <Link to="/appointments">View consult</Link>
        </Button>
      )}
    </div>
  );
}

function Stat({ value, label, meta }: { value: number; label: string; meta?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-xs">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-1 text-[26px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-ink-muted">{meta ?? ' '}</p>
    </div>
  );
}
