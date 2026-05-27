package care.heron.api.document;

import care.heron.api.document.enums.BookingStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

// Bookings reference User._id for both parties — the booking is a
// relationship between two accounts. Profile metadata (specialization,
// name, picture) loads via separate fetch because it changes
// independently. meetingLink is denormalized at create time so the
// patient's join link is stable even if the doctor updates their
// default later (audit-stable, like an invoice line item).
//
// Conflict detection lives at the Mongo layer via a unique partial index
// on (doctorUserId, startsAt) filtered to status=CONFIRMED — see
// DatabaseInitializer. Cancelled bookings don't block re-booking the
// slot. Idempotency is enforced via a unique sparse index on
// (patientUserId, idempotencyKey).
@Document("bookings")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Booking {

    @Id
    private String id;

    private String patientUserId;

    private String doctorUserId;

    // UTC. Half-hour boundary enforced at the service layer, not the schema.
    private Instant startsAt;

    private Instant endsAt;

    private BookingStatus status;

    private String concernNote;

    // Snapshot of doctor.defaultMeetingLink at create time.
    private String meetingLink;

    // The doctor's consultation notes + prescription, embedded. Null until the
    // doctor finalizes the consult (which also flips status to COMPLETED).
    private ConsultationRecord consultationRecord;

    // Append-only trail of every time this booking was moved. Each entry records
    // the slot it was moved AWAY from; the live startsAt/endsAt above is always
    // the current slot. A List (not a single field) so the full history survives
    // repeated reschedules — the medico-legally honest record of when a consult
    // shifted. Null/empty means the booking has never been rescheduled.
    private List<RescheduledFrom> rescheduledHistory;

    // Stamped when the patient cancels. Null while CONFIRMED/COMPLETED. Kept
    // separate from updatedAt (which any save touches) so "when was this
    // cancelled" is answerable without diffing the audit log.
    private Instant cancelledAt;

    // Stamped when the "upcoming visit" reminder has been sent, so the scheduler
    // sweep never reminds the same booking twice (idempotency marker). Null until
    // the booking enters the reminder window.
    private Instant reminderSentAt;

    // Client-supplied UUID. Scoped per patient via the unique sparse index.
    private String idempotencyKey;

    // SHA-256 of the canonical request body. Same key + different body =
    // 422 (idempotency key reused for a different request) rather than
    // a silent return of the original booking.
    private String idempotencyKeyBodyHash;

    // Optimistic locking — prevents lost-update on a cancel/complete race.
    @Version
    private Long version;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant deletedAt;

    // One leg of a reschedule: the slot this booking occupied before a move.
    // Embedded value object with no independent lifecycle, same pattern as
    // ConsultationRecord. rescheduledAt is when the patient made the change.
    @Getter
    @Setter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class RescheduledFrom {
        private Instant previousStartsAt;
        private Instant previousEndsAt;
        private Instant rescheduledAt;
    }
}
