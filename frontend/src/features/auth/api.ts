import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

type Role = 'PATIENT' | 'DOCTOR';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: Role;
};

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
        skipAuth: true,
      }),
  });
}

export function useRegisterPatient() {
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string }) =>
      apiFetch<AuthResponse>('/api/auth/register/patient', {
        method: 'POST',
        body: JSON.stringify(body),
        skipAuth: true,
      }),
  });
}

export function useRegisterDoctor() {
  return useMutation({
    mutationFn: (body: {
      email: string;
      password: string;
      name: string;
      specialization: string;
      // Pre-filled in the form; backend generates a fallback if blank.
      prcLicenseNo?: string;
      ptrNo?: string;
    }) =>
      apiFetch<AuthResponse>('/api/auth/register/doctor', {
        method: 'POST',
        body: JSON.stringify(body),
        skipAuth: true,
      }),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/auth/logout', {
        method: 'POST',
        skipAuth: true,
      }),
  });
}
