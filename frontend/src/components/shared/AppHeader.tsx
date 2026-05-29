import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

type AppHeaderProps = {
  // Right-side nav — supplied by the page tree so guest vs authed surface stays here.
  children?: React.ReactNode;
};

export function AppHeader({ children }: AppHeaderProps) {
  // The bottom border/shadow appears only once the page has scrolled, so the
  // header sits flush at rest and lifts off the content as you move — no
  // entrance animation, just a quiet scroll cue. A transparent border at rest
  // keeps the height fixed (no layout shift when it turns on).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-surface transition-shadow ${
        scrolled ? 'border-line shadow-sm' : 'border-transparent'
      }`}
    >
      <div className="container mx-auto flex h-16 items-center gap-6 px-4">
        <Link
          to="/"
          aria-label="Heron — home"
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Logo size={40} variant="mono" />
          <span className="text-lg font-semibold tracking-tight text-ink">Heron</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
