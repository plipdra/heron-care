import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

// Appears only after the page has been scrolled a fair way down, so it never
// clutters a short page; smooth-scrolls back to the top. Solid primary, no
// shadow (BRAND.md §9 — stillness over elevation); the contrast carries it.
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
