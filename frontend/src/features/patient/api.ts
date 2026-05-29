import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// Mirrors the backend Sex enum. UNSPECIFIED is the explicit "prefer not to say".
export type Sex = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNSPECIFIED', label: 'Prefer not to say' },
];

export type PatientProfile = {
  id: string;
  userId: string;
  name: string | null;
  birthday: string | null;
  sex: Sex | null;
  sexLabel: string | null;
  weightKg: number | null;
  heightCm: number | null;
  contactNumber: string | null;
  // Structured care profile. A null list means "not filled in"; an empty list
  // means "actively none" (e.g. no known allergies).
  conditions: string[] | null;
  allergies: string[] | null;
  medications: string[] | null;
  notesForDoctor: string | null;
  profilePictureUrl: string;
};

export function useMyPatientProfile() {
  return useQuery({
    queryKey: ['patients', 'me'],
    queryFn: () => apiFetch<PatientProfile>('/api/patients/me'),
  });
}

// null clears a field (full replace from the editor); undefined would be dropped
// from the JSON and leave the value unchanged.
export type UpdatePatientProfileBody = {
  name?: string | null;
  birthday?: string | null;
  sex?: Sex | null;
  weightKg?: number | null;
  heightCm?: number | null;
  contactNumber?: string | null;
  conditions?: string[] | null;
  allergies?: string[] | null;
  medications?: string[] | null;
  notesForDoctor?: string | null;
};

export function useUpdateMyPatientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePatientProfileBody) =>
      apiFetch<PatientProfile>('/api/patients/me', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['patients', 'me'], data);
    },
  });
}

export function useUploadProfilePicture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dataUrl: string) =>
      apiFetch<void>('/api/profile-pictures/me', {
        method: 'PUT',
        body: JSON.stringify({ dataUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', 'me'] });
    },
  });
}

export function useDeleteProfilePicture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/profile-pictures/me', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', 'me'] });
    },
  });
}
