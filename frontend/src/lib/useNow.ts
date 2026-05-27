import { useEffect, useState } from 'react';

// A clock that re-renders on an interval. Appointment status is DERIVED from the
// current time (an upcoming visit becomes "ended" the moment its end passes), so
// a `now` frozen at first render leaves an ended visit still showing Join /
// Reschedule / Cancel until the page reloads. Ticking re-evaluates that on a
// cadence. 30s is plenty for half-hour slots and costs a trivial re-render.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
