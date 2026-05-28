package care.heron.api.dto.booking;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/*
 * Adversarial matrix for the booking request DTOs. Bean Validation covers shape:
 * doctorUserId present, startsAt present, concernNote sane. The semantic slot
 * rules (future, 30-min boundary, in-schedule, not blocked) live in
 * BookingService.validateSlot and are exercised by BookingServiceTest — this
 * class guards the request envelope.
 */
class BookingRequestValidationTest {

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

    private boolean fieldHasError(Set<? extends ConstraintViolation<?>> violations, String field) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    private final Instant when = Instant.parse("2026-06-01T09:00:00Z");

    // ---- CreateBookingRequest ----

    @Test
    void accepts_a_well_formed_create_request() {
        var req = new CreateBookingRequest("doctor-001", when, "Persistent cough for a week.");
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void create_allows_omitted_concern_note() {
        var req = new CreateBookingRequest("doctor-001", when, null);
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void create_requires_doctor_id() {
        assertThat(fieldHasError(validator.validate(
                new CreateBookingRequest("", when, null)), "doctorUserId")).isTrue();
        assertThat(fieldHasError(validator.validate(
                new CreateBookingRequest("   ", when, null)), "doctorUserId")).isTrue();
    }

    @Test
    void create_requires_starts_at() {
        assertThat(fieldHasError(validator.validate(
                new CreateBookingRequest("doctor-001", null, null)), "startsAt")).isTrue();
    }

    @Test
    void create_rejects_whitespace_only_concern_note() {
        var req = new CreateBookingRequest("doctor-001", when, "   ");
        assertThat(fieldHasError(validator.validate(req), "concernNote")).isTrue();
    }

    @Test
    void create_rejects_concern_note_over_1000_chars() {
        var req = new CreateBookingRequest("doctor-001", when, "x".repeat(1001));
        assertThat(fieldHasError(validator.validate(req), "concernNote")).isTrue();
    }

    // ---- RescheduleRequest ----

    @Test
    void reschedule_requires_starts_at() {
        assertThat(fieldHasError(validator.validate(new RescheduleRequest(null)), "startsAt")).isTrue();
    }

    @Test
    void reschedule_accepts_a_starts_at() {
        assertThat(validator.validate(new RescheduleRequest(when))).isEmpty();
    }
}
