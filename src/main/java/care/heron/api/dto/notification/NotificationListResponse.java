package care.heron.api.dto.notification;

import java.util.List;

// History + the unread count in one payload, so the bell badge and the panel
// hydrate from a single request.
public record NotificationListResponse(List<NotificationResponse> items, long unreadCount) {}
