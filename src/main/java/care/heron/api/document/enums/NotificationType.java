package care.heron.api.document.enums;

public enum NotificationType {
    BOOKING_CONFIRMED,
    BOOKING_CANCELLED,
    BOOKING_RESCHEDULED,
    AVAILABILITY_CHANGED,
    // Reserved for the deferred reminder job — the seam exists, nothing emits it yet.
    APPOINTMENT_REMINDER
}
