package care.heron.api.document;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;

// Embedded on DoctorProfile. The timezone is on the parent record (not on
// each rule) because availability rules are authored in the doctor's
// local time and "Mon-Fri 09:00-17:00" has no meaning without a TZ. TZ is
// treated as immutable for MVP — a doctor who relocates triggers a
// profile reset, not a silent shift of all future slots.
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Availability {

    // IANA zone id, e.g. "Asia/Manila". ZoneId.of() at read time turns this
    // into the live zone used for slot derivation.
    private String timeZone;

    private List<WeeklyScheduleEntry> weeklySchedule;

    private List<BlockedRange> blockedRanges;

    @Getter
    @Setter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class WeeklyScheduleEntry {

        private DayOfWeek dayOfWeek;

        // Local time in the parent Availability's timeZone.
        private LocalTime startTime;

        // Local time in the parent Availability's timeZone. Exclusive: a
        // 09:00-17:00 entry yields slots up to but not including 17:00.
        private LocalTime endTime;
    }

    @Getter
    @Setter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class BlockedRange {

        // UTC. Stored as Instant because absolute time, not zoned: a
        // booked vacation is a fixed wall-clock interval regardless of
        // where the doctor is sitting.
        private Instant startsAt;

        private Instant endsAt;

        private String reason;
    }

    // Default for newly seeded doctors and for backfilling existing
    // records that pre-date the availability schema. Mon-Fri 09:00-17:00
    // local time, no blocked ranges. Doctor changes via the schedule-
    // management endpoint once that ships.
    public static Availability defaultBusinessHours() {
        return Availability.builder()
                .timeZone("Asia/Manila")
                .weeklySchedule(List.of(
                        weekday(DayOfWeek.MONDAY),
                        weekday(DayOfWeek.TUESDAY),
                        weekday(DayOfWeek.WEDNESDAY),
                        weekday(DayOfWeek.THURSDAY),
                        weekday(DayOfWeek.FRIDAY)))
                .blockedRanges(List.of())
                .build();
    }

    // Mon-Sat 09:00-17:00 — for demo doctors who hold Saturday clinics, so a
    // demo recorded on a Saturday lands on a populated working day rather than
    // an "Off" day. Same hours as the weekday default, plus Saturday.
    public static Availability businessHoursMonToSat() {
        return Availability.builder()
                .timeZone("Asia/Manila")
                .weeklySchedule(List.of(
                        weekday(DayOfWeek.MONDAY),
                        weekday(DayOfWeek.TUESDAY),
                        weekday(DayOfWeek.WEDNESDAY),
                        weekday(DayOfWeek.THURSDAY),
                        weekday(DayOfWeek.FRIDAY),
                        weekday(DayOfWeek.SATURDAY)))
                .blockedRanges(List.of())
                .build();
    }

    private static WeeklyScheduleEntry weekday(DayOfWeek day) {
        return WeeklyScheduleEntry.builder()
                .dayOfWeek(day)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(17, 0))
                .build();
    }
}
