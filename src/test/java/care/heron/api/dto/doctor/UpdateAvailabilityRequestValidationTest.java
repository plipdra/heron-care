package care.heron.api.dto.doctor;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/*
 * Shape-level matrix for the availability replace DTO. Bean Validation here
 * guards null/size/required-component; the cross-field invariants (end-after-
 * start, one-entry-per-day, sane horizon) are the service's job and are covered
 * by DoctorServiceTest. This pins the envelope those rules run inside.
 */
class UpdateAvailabilityRequestValidationTest {

    static ValidatorFactory factory;
    static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private boolean anyPathContains(Set<? extends ConstraintViolation<?>> violations, String fragment) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().contains(fragment));
    }

    private UpdateAvailabilityRequest.WeeklyEntry entry(DayOfWeek day, String start, String end) {
        return new UpdateAvailabilityRequest.WeeklyEntry(
                day,
                start == null ? null : LocalTime.parse(start),
                end == null ? null : LocalTime.parse(end));
    }

    @Test
    void accepts_a_well_formed_week() {
        var req = new UpdateAvailabilityRequest(
                List.of(entry(DayOfWeek.MONDAY, "09:00", "17:00")),
                List.of());
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void weekly_schedule_is_required() {
        var req = new UpdateAvailabilityRequest(null, List.of());
        assertThat(anyPathContains(validator.validate(req), "weeklySchedule")).isTrue();
    }

    @Test
    void weekly_entry_requires_its_components() {
        var req = new UpdateAvailabilityRequest(
                List.of(entry(null, null, null)),
                List.of());
        var violations = validator.validate(req);
        assertThat(anyPathContains(violations, "dayOfWeek")).isTrue();
        assertThat(anyPathContains(violations, "startTime")).isTrue();
        assertThat(anyPathContains(violations, "endTime")).isTrue();
    }

    @Test
    void rejects_more_than_seven_weekly_entries() {
        List<UpdateAvailabilityRequest.WeeklyEntry> tooMany = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            tooMany.add(entry(DayOfWeek.MONDAY, "09:00", "17:00"));
        }
        var req = new UpdateAvailabilityRequest(tooMany, List.of());
        assertThat(anyPathContains(validator.validate(req), "weeklySchedule")).isTrue();
    }

    @Test
    void blocked_range_requires_start_and_end() {
        var req = new UpdateAvailabilityRequest(
                List.of(entry(DayOfWeek.MONDAY, "09:00", "17:00")),
                List.of(new UpdateAvailabilityRequest.BlockedRangeRequest(null, null, "Holiday")));
        var violations = validator.validate(req);
        assertThat(anyPathContains(violations, "startsAt")).isTrue();
        assertThat(anyPathContains(violations, "endsAt")).isTrue();
    }

    @Test
    void rejects_blocked_range_reason_over_200_chars() {
        var req = new UpdateAvailabilityRequest(
                List.of(entry(DayOfWeek.MONDAY, "09:00", "17:00")),
                List.of(new UpdateAvailabilityRequest.BlockedRangeRequest(
                        Instant.parse("2026-06-01T00:00:00Z"),
                        Instant.parse("2026-06-02T00:00:00Z"),
                        "x".repeat(201))));
        assertThat(anyPathContains(validator.validate(req), "reason")).isTrue();
    }
}
