package care.heron.api.dto.doctor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;

// Whole-document replace of the editable availability — NOT a patch. The body
// is the doctor's complete new week + time-off; the server keeps the existing
// timeZone (immutable for MVP), so it is deliberately absent here. Bean
// Validation covers shape/null/size; cross-field rules (end-after-start,
// one-entry-per-day, sane span) are enforced in the service since annotations
// can't express them.
public record UpdateAvailabilityRequest(
        @NotNull(message = "weeklySchedule is required")
        @Size(max = 7, message = "weeklySchedule cannot exceed 7 entries")
        @Valid
        List<WeeklyEntry> weeklySchedule,

        @Size(max = 366, message = "blockedRanges cannot exceed 366 entries")
        @Valid
        List<BlockedRangeRequest> blockedRanges
) {
    public record WeeklyEntry(
            @NotNull(message = "dayOfWeek is required") DayOfWeek dayOfWeek,
            @NotNull(message = "startTime is required") LocalTime startTime,
            @NotNull(message = "endTime is required") LocalTime endTime
    ) {}

    public record BlockedRangeRequest(
            @NotNull(message = "startsAt is required") Instant startsAt,
            @NotNull(message = "endsAt is required") Instant endsAt,
            @Size(max = 200, message = "reason must not exceed 200 characters") String reason
    ) {}
}
