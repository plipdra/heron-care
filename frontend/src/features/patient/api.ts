import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type PatientProfile = {
  id: string;
  userId: string;
  name: string | null;
  birthday: string | null;
  weightKg: number | null;
  heightCm: number | null;
  contactNumber: string | null;
  medicalHistory: string | null;
  profilePictureUrl: string;
};

export function useMyPatientProfile() {
  return useQuery({
    queryKey: ['patients', 'me'],
    queryFn: () => apiFetch<PatientProfile>('/api/patients/me'),
  });
}

export type UpdatePatientProfileBody = {
  name?: string;
  birthday?: string;
  weightKg?: number;
  heightCm?: number;
  contactNumber?: string;
  medicalHistory?: string;
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
