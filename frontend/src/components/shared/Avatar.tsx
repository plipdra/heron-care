import { cn } from '@/lib/utils';

type AvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
};

// "Maria Reyes, MD" -> "MR"; "Patricia Cruz" -> "PC".
// Trailing physician suffixes are stripped so they don't leak into the initials.
function getInitials(name: string): string {
  const cleaned = name.replace(/,?\s+(MD|DO|PhD|RN)\.?$/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, photoUrl, size = 48, className }: AvatarProps) {
  const dimension = { width: size, height: size };
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        style={dimension}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{ ...dimension, fontSize: Math.round(size * 0.38) }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary',
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
