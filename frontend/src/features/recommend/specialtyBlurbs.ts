// One calm, non-diagnostic sentence describing each specialty's scope — shown as
// the orienting sub-line under "We suggest {specialty}." on the result panel.
//
// The API contract returns only a specialty LABEL and a per-doctor reason; it does
// NOT return specialty prose, so these are authored here. They describe what the
// SPECIALTY covers (never the patient's condition or a diagnosis) and stay inside
// the calm/precise/warm voice. Keyed by the exact `suggestedSpecializationLabel`
// values (the fixed 10-item enum — see the wiring digest §4).
const SPECIALTY_BLURBS: Record<string, string> = {
  'General Practice':
    'General practitioners handle a broad range of everyday health concerns and point you onward when a specialist is needed.',
  'Internal Medicine':
    'Internists focus on adult general and complex medical conditions, often coordinating longer-term care.',
  Pediatrics:
    'Pediatricians care for infants, children, and teens — from routine check-ups to childhood illnesses.',
  'OB-GYN':
    "OB-GYNs focus on reproductive, pregnancy, and gynecological health.",
  Cardiology:
    'Cardiologists focus on the heart and circulation, including chest and blood-pressure concerns.',
  Dermatology:
    'Dermatologists focus on the skin, hair, and nails — from rashes to changes worth a closer look.',
  Psychiatry:
    'Psychiatrists focus on mental health, including mood, anxiety, and sleep concerns.',
  Neurology:
    'Neurologists focus on the brain and nervous system, including headaches, dizziness, and numbness.',
  Orthopedics:
    'Orthopedic specialists focus on bones, joints, and muscles, including injuries and joint pain.',
  Endocrinology:
    'Endocrinologists focus on hormones and metabolism, including thyroid and blood-sugar concerns.',
};

// The tap-affordance line is constant across specialties, so it lives here rather
// than in each blurb. Falls back to a generic, claim-free line for any unmapped label.
export function specialtySubcopy(label: string | null | undefined): string {
  const blurb =
    (label && SPECIALTY_BLURBS[label]) ??
    'These specialists are most likely a fit for what you described.';
  return `${blurb} Tap any specialist to see availability.`;
}
