import { tokenStore } from './tokenStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export type ProblemDetail = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  problem?: ProblemDetail;

  constructor(status: number, message: string, problem?: ProblemDetail) {
    super(message);
    this.status = status;
    this.problem = problem;
  }
}

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefreshOnUnauthorized?: boolean;
};

// Single in-flight refresh — prevents concurrent 401s from each spawning their own refresh.
let refreshInFlight: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token available');
  }

  refreshInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      tokenStore.clear();
      throw new ApiError(response.status, 'Refresh failed');
    }
    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    tokenStore.set(data.accessToken, data.refreshToken);
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipAuth, skipRefreshOnUnauthorized, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const access = tokenStore.getAccess();
    if (access) finalHeaders.set('Authorization', `Bearer ${access}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: finalHeaders });

  if (response.status === 401 && !skipAuth && !skipRefreshOnUnauthorized) {
    try {
      await refreshAccessToken();
    } catch {
      throw new ApiError(401, 'Session expired');
    }
    return apiFetch<T>(path, { ...options, skipRefreshOnUnauthorized: true });
  }

  if (!response.ok) {
    let problem: ProblemDetail | undefined;
    try {
      problem = (await response.json()) as ProblemDetail;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, problem?.detail ?? response.statusText, problem);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
