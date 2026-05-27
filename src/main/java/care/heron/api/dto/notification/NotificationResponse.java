package care.heron.api.dto.notification;

import care.heron.api.document.Notification;

import java.time.Instant;

public record NotificationResponse(
        String id,
        String type,
        String message,
        Instant startsAt,
        boolean read,
        Instant createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType().name(),
                n.getMessage(),
                n.getStartsAt(),
                n.getReadAt() != null,
                n.getCreatedAt());
    }
}
