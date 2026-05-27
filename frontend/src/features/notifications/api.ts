import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  // The related appointment's start (local-tz formatted in the panel), or null.
  startsAt: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationList = {
  items: NotificationItem[];
  unreadCount: number;
};

// Hydrate-on-load + history. The SSE stream invalidates this key on a live event,
// so the badge and panel both re-derive from server truth in one place.
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationList>('/api/notifications'),
  });
}

// Marks all of the caller's unread as read (panel-open action). No id — the
// server scopes the update to the principal.
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/notifications/read', { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// Mints a short-lived stream token (Bearer-gated via apiFetch, which also handles
// access-token refresh). The EventSource then passes it as a query param.
export function fetchStreamToken() {
  return apiFetch<{ token: string }>('/api/notifications/stream-token', { method: 'POST' });
}
