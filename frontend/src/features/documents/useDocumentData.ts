import { useMyBookings, useConsultationNotes, type PatientBooking, type ConsultationRecord } from '@/features/booking/api';
import { useMyPatientProfile, type PatientProfile } from '@/features/patient/api';

// Gathers everything the printable clinical documents need from data the patient
// already has rights to: the booking (doctor identity + licenses + visit time),
// the finalized consultation record (SOAP + prescription), and the patient's own
// profile (demographics). One hook so both documents source identically.
export type DocumentData = {
  booking: PatientBooking | null;
  record: ConsultationRecord | undefined;
  patient: PatientProfile | undefined;
  isPending: boolean;
  isError: boolean;
  notFound: boolean;
};

export function useDocumentData(bookingId: string): DocumentData {
  const bookings = useMyBookings();
  const notes = useConsultationNotes(bookingId, true);
  const profile = useMyPatientProfile();

  const booking = bookings.data?.content.find((b) => b.id === bookingId) ?? null;
  const isPending = bookings.isPending || notes.isPending || profile.isPending;
  const isError = bookings.isError || notes.isError || profile.isError;

  return {
    booking,
    record: notes.data,
    patient: profile.data,
    isPending,
    isError,
    notFound: !isPending && !bookings.isError && !booking,
  };
}

// --- Deterministic MVP-flavor identifiers (stable per id, not stored) ---

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// A stable document reference, e.g. "HRN-2026-04821", derived from the booking id.
export function referenceFor(bookingId: string, year: number): string {
  return `HRN-${year}-${String(hash(bookingId) % 100000).padStart(5, '0')}`;
}

// A stable patient record id, e.g. "HRN-PT-10293".
export function patientIdFor(userId: string | null | undefined): string {
  return `HRN-PT-${String(hash(userId ?? 'unknown') % 100000).padStart(5, '0')}`;
}

// Body-mass index from patient-reported weight/height, rounded to one decimal.
export function bmiFor(weightKg: number | null, heightCm: number | null): string | null {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const m = heightCm / 100;
  return (weightKg / (m * m)).toFixed(1);
}
