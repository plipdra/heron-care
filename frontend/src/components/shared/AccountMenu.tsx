import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { apiFetch } from '@/lib/api';
import { useAuthedImageUrl } from '@/lib/useAuthedImageUrl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/AuthContext';

const ROLE_LABEL: Record<string, string> = { PATIENT: 'Patient', DOCTOR: 'Doctor' };

// The session's account menu — the authed bar's right anchor. Profile + Sign out
// live here, off the flat bar, with Sign out as the terminal/destructive action.
// The session token only carries email/role, so we fetch the role-appropriate
// profile for the display name (shared cache with the profile pages) — that's
// what drives the avatar initials, falling back to the email handle while it loads.
export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: [user?.role === 'DOCTOR' ? 'doctors' : 'patients', 'me'],
    queryFn: () =>
      apiFetch<{ name: string | null }>(
        user?.role === 'DOCTOR' ? '/api/doctors/me' : '/api/patients/me',
      ),
    enabled: !!user,
  });

  // The avatar URL is otherwise static, so a re-uploaded or removed picture
  // wouldn't refresh until a full reload. Key it on the profile query's
  // last-updated timestamp: that query shares the ['…','me'] key the profile-edit
  // and picture upload/delete mutations invalidate, so any profile change
  // re-fetches it, bumps dataUpdatedAt, and busts the avatar here too — a removed
  // picture then 404s and Avatar falls back to initials.
  const photoUrl = useAuthedImageUrl(
    user ? `/api/profile-pictures/${user.id}?v=${profile.dataUpdatedAt}` : null,
  );

  if (!user) return null;

  const handle = user.email.split('@')[0].replace(/[._-]+/g, ' ');
  const displayName = profile.data?.name?.trim() || handle;

  async function handleSignOut() {
    await logout();
    navigate('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="group flex items-center gap-1 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Avatar name={displayName} photoUrl={photoUrl} size={32} />
          <ChevronDown className="h-4 w-4 text-ink-muted transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-ink">{displayName}</p>
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
          <p className="text-xs text-ink-muted">{ROLE_LABEL[user.role] ?? user.role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserIcon className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="text-danger focus:bg-danger/10 focus:text-danger"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
