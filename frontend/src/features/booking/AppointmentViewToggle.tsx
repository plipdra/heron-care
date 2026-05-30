import { CalendarDays, CalendarRange, LayoutList } from 'lucide-react';

export type ApptView = 'list' | 'week' | 'month';

// List / Week / Month segmented control, shared by the patient and doctor
// appointment surfaces. The list is the default (it carries the row actions);
// week and month are read-only orientation views.
export function AppointmentViewToggle({
  view,
  onChange,
}: {
  view: ApptView;
  onChange: (v: ApptView) => void;
}) {
  const opt = (v: ApptView, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => onChange(v)}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        view === v ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="inline-flex gap-1 rounded-lg border border-line bg-surface-raised p-1">
      {opt('list', 'List', <LayoutList className="h-4 w-4" />)}
      {opt('week', 'Week', <CalendarRange className="h-4 w-4" />)}
      {opt('month', 'Month', <CalendarDays className="h-4 w-4" />)}
    </div>
  );
}
