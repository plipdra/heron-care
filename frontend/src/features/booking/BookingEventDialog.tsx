import { type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar } from '@/components/shared/Avatar';
import { MeetingLinkActions } from '@/components/shared/MeetingLinkActions';
import { formatFullDateTime } from '@/lib/datetime';
import { StatusPill, type DisplayStatus } from './status';

// Opened from a calendar event (week or month) so a booking is actionable from
// the grid, not just the list. Shows the same details the list card carries —
// who, when, the note, the join link — plus role-appropriate actions.
export function BookingEventDialog({
  name,
  badge,
  startsAt,
  status,
  statusNote,
  concern,
  concernLabel,
  joinable,
  meetingLink,
  actions,
  onClose,
}: {
  name: string;
  badge?: ReactNode;
  startsAt: string;
  status: DisplayStatus;
  statusNote?: ReactNode;
  concern: string | null;
  concernLabel: string;
  joinable: boolean;
  meetingLink: string | null;
  actions: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={name} size={44} />
            <div>
              <DialogTitle>{name}</DialogTitle>
              {badge && <div className="mt-1">{badge}</div>}
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-md border border-ai-glow bg-ai-surface px-4 py-3">
          <p className="tabular font-semibold text-primary-800">{formatFullDateTime(startsAt)}</p>
          <div className="mt-1.5">
            <StatusPill status={status} />
          </div>
          {statusNote && <p className="mt-2 text-xs leading-relaxed text-ink-muted">{statusNote}</p>}
        </div>

        <div>
          <p className="text-xs font-medium text-ink-muted">{concernLabel}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
            {concern ?? <span className="text-ink-muted">No note added.</span>}
          </p>
        </div>

        {joinable && meetingLink && (
          <div className="flex flex-col gap-1.5">
            <MeetingLinkActions link={meetingLink} />
            <p className="text-xs text-ink-muted">This link opens your video room.</p>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
