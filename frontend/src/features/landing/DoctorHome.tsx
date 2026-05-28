import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// A logged-in doctor doesn't need the patient symptom-router on the homepage —
// send them straight toward their consults. Shared by both landing variants.
export function DoctorHome() {
  return (
    <main className="container mx-auto px-4 py-20 md:py-28">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Welcome back.</h1>
        <p className="mt-4 text-lg text-ink-muted">
          Your upcoming consults and each patient's context are a click away.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/appointments">Go to your consults</Link>
        </Button>
      </div>
    </main>
  );
}
