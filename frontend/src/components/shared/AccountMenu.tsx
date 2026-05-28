import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
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
// We only hold email in the session (the display name lives on the profile,
// fetched per page), so the avatar initials + identity line use the email.
export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handle = user.email.split('@')[0].replace(/[._-]+/g, ' ');

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
          className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Avatar name={handle} size={36} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-ink">{user.email}</p>
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
