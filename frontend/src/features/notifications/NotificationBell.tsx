import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarClock,
  CalendarCog,
  CalendarPlus,
  CalendarX,
  Check,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_BASE_URL } from '@/lib/api';
import { formatFullDateTime } from '@/lib/datetime';
import { fetchStreamToken, useMarkAllRead, useNotifications } from './api';

// Per-type glyph — shape carries the meaning; colour stays neutral (BRAND.md §5
// reserves red/amber for "something is wrong", which routine scheduling is not).
const ICON_FOR: Record<string, LucideIcon> = {
  BOOKING_CONFIRMED: CalendarPlus,
  BOOKING_CANCELLED: CalendarX,
  BOOKING_RESCHEDULED: CalendarClock,
  AVAILABILITY_CHANGED: CalendarCog,
  APPOINTMENT_REMINDER: Clock,
};

// Calm relative stamp for the panel ("just now" / "5m ago" / "2h ago" / "3d ago").
function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// The notification center: a quiet bell + unread badge that "stands quietly until
// care needs to act". The persistent panel (server-backed) is the system of
// record; SSE just keeps it live. The panel is a Radix Popover, so Escape,
// outside-click, and focus return are handled for us. One EventSource, owned here
// — the bell renders only while authenticated, so the stream opens on sign-in and
// closes on sign-out.
export function NotificationBell() {
  const { data } = useNotifications();
  const markAllRead = useMarkAllRead();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  // Live stream. Re-mints a fresh token on every (re)connect — the token is
  // short-lived, so reconnecting after a drop or expiry just gets a new one. We
  // drive reconnection ourselves (not native EventSource retry, which would
  // replay an expired token) with capped backoff.
  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;

    async function connect() {
      if (closed) return;
      try {
        const { token } = await fetchStreamToken();
        if (closed) return;
        es = new EventSource(
          `${API_BASE_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`,
        );
        es.onopen = () => {
          backoff = 1000;
        };
        es.addEventListener('notification', () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
          queryClient.invalidateQueries({ queryKey: ['bookings', 'doctor'] });
          queryClient.invalidateQueries({ queryKey: ['doctor-slots'] });
        });
        es.onerror = () => {
          es?.close();
          es = null;
          if (closed) return;
          retry = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 15000);
        };
      } catch {
        if (closed) return;
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15000);
      }
    }

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [queryClient]);

  // Opening the panel clears the unread badge.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread > 0) markAllRead.mutate();
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Notifications</p>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Check className="mx-auto h-5 w-5 text-success" />
            <p className="mt-2 text-sm text-ink-muted">
              You're all caught up. Booking and schedule updates appear here.
            </p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {items.map((n) => {
              const Icon = ICON_FOR[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate('/appointments');
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-tint ${
                      n.read ? '' : 'bg-primary-tint/40'
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-sm text-ink">{n.message}</span>
                      {n.startsAt && (
                        <span className="tabular text-xs text-ink-muted">
                          {formatFullDateTime(n.startsAt)}
                        </span>
                      )}
                      <span className="text-xs text-ink-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
