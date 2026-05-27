package care.heron.api.dto.doctor;

import care.heron.api.document.Availability;
import care.heron.api.document.Availability.BlockedRange;
import care.heron.api.document.Availability.WeeklyScheduleEntry;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;

// The doctor's own availability, surfaced so the schedule editor can pre-fill.
// timeZone is read-only here (immutable for MVP) — shown for context, never
// edited. Empty lists rather than null so the client needn't null-guard.
public record AvailabilityResponse(
        String timeZone,
        List<WeeklyEntry> weeklySchedule,
        List<BlockedRangeResponse> blockedRanges
) {
    public static AvailabilityResponse from(Availability availability) {
        if (availability == null) {
            return null;
        }
        List<WeeklyEntry> weekly = availability.getWeeklySchedule() == null
                ? List.of()
                : availability.getWeeklySchedule().stream().map(WeeklyEntry::from).toList();
        List<BlockedRangeResponse> blocked = availability.getBlockedRanges() == null
                ? List.of()
                : availability.getBlockedRanges().stream().map(BlockedRangeResponse::from).toList();
        return new AvailabilityResponse(availability.getTimeZone(), weekly, blocked);
    }

    public record WeeklyEntry(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
        static WeeklyEntry from(WeeklyScheduleEntry entry) {
            return new WeeklyEntry(entry.getDayOfWeek(), entry.getStartTime(), entry.getEndTime());
        }
    }

    public record BlockedRangeResponse(Instant startsAt, Instant endsAt, String reason) {
        static BlockedRangeResponse from(BlockedRange range) {
            return new BlockedRangeResponse(range.getStartsAt(), range.getEndsAt(), range.getReason());
        }
    }
}
