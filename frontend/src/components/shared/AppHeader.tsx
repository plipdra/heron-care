import { Link } from 'react-router-dom';
import { Logo } from './Logo';

type AppHeaderProps = {
  // Right-side nav — supplied by the page tree so guest vs authed surface stays here.
  children?: React.ReactNode;
};

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={32} />
          <span className="text-lg font-semibold tracking-tight">Heron</span>
        </Link>
        <nav className="flex items-center gap-2">{children}</nav>
      </div>
    </header>
  );
}
