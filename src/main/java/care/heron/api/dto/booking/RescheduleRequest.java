package care.heron.api.dto.booking;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

// Body for moving an existing booking to a new slot. Only the new start time —
// the booking id is in the path, and the doctor is read from the booking itself
// (a patient can't redirect a reschedule onto a different doctor). endsAt is
// derived server-side from the fixed slot duration, never trusted from the client.
public record RescheduleRequest(
        @NotNull(message = "startsAt is required.")
        Instant startsAt
) {}
