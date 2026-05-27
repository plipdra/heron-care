import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router keeps the window scroll position across navigations, which can
// drop you mid-page on a fresh route. Reset to the top whenever the path
// changes. Renders nothing.
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
