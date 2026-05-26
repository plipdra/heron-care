package care.heron.api.exception;

import java.time.Instant;

// Thrown when a booking conflict is detected (the slot is already taken
// for the requested doctor + start time). Mapped to 409 Conflict by
// GlobalExceptionHandler. Alternative slots are surfaced to the client
// at the controller layer, not here, because the slot-derivation logic
// is a presentation concern.
public class SlotTakenException extends RuntimeException {

    private final String doctorUserId;
    private final Instant attemptedStartsAt;

    public SlotTakenException(String doctorUserId, Instant attemptedStartsAt) {
        super("The requested slot is already taken.");
        this.doctorUserId = doctorUserId;
        this.attemptedStartsAt = attemptedStartsAt;
    }

    public String getDoctorUserId() {
        return doctorUserId;
    }

    public Instant getAttemptedStartsAt() {
        return attemptedStartsAt;
    }
}
