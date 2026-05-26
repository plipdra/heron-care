// Mirrors care.heron.api.document.enums.Specialization on the backend.
// Keep in sync when adding or renaming specialties — there is no codegen
// for Day 1, by design (Future Work).

export const SPECIALIZATIONS = [
  { value: 'GENERAL_PRACTICE', label: 'General Practice' },
  { value: 'INTERNAL_MEDICINE', label: 'Internal Medicine' },
  { value: 'PEDIATRICS', label: 'Pediatrics' },
  { value: 'OB_GYN', label: 'OB-GYN' },
  { value: 'CARDIOLOGY', label: 'Cardiology' },
  { value: 'DERMATOLOGY', label: 'Dermatology' },
  { value: 'PSYCHIATRY', label: 'Psychiatry' },
  { value: 'NEUROLOGY', label: 'Neurology' },
  { value: 'ORTHOPEDICS', label: 'Orthopedics' },
  { value: 'ENDOCRINOLOGY', label: 'Endocrinology' },
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number]['value'];

export function specializationLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return SPECIALIZATIONS.find((s) => s.value === value)?.label ?? null;
}
