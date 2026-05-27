package care.heron.api.document;

import care.heron.api.document.enums.NotificationType;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// One row per recipient — the recipientUserId is the only fan-out axis. The
// message is pre-rendered and PHI-minimal (it names neither party nor any
// clinical detail); the recipient already sees the counterparty + time on their
// own appointment row, and `startsAt` lets the panel show that time inline in
// the viewer's local zone without an N+1 fetch.
@Document("notifications")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification {

    @Id
    private String id;

    private String recipientUserId;

    private NotificationType type;

    private String message;

    // The related appointment's start, for inline display; null for events with
    // no single appointment (e.g. a doctor-wide availability change).
    private Instant startsAt;

    // null = unread. The badge counts these.
    private Instant readAt;

    @CreatedDate
    private Instant createdAt;
}
