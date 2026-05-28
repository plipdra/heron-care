package care.heron.api.validation;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/*
 * Direct test of the birthday range validator against a FIXED clock, so the
 * boundary cases (today, tomorrow, exactly 120 years ago, 120 years + 1 day) are
 * deterministic rather than dependent on the wall clock.
 */
class PastWithinYearsValidatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 5, 28);

    private PastWithinYearsValidator validator(int maxYears) {
        Clock fixed = Clock.fixed(Instant.parse("2026-05-28T00:00:00Z"), ZoneOffset.UTC);
        PastWithinYearsValidator v = new PastWithinYearsValidator(fixed);
        v.initialize(new PastWithinYears() {
            @Override public Class<? extends java.lang.annotation.Annotation> annotationType() {
                return PastWithinYears.class;
            }
            @Override public String message() { return ""; }
            @Override public int maxYears() { return maxYears; }
            @Override public Class<?>[] groups() { return new Class<?>[0]; }
            @Override public Class<? extends jakarta.validation.Payload>[] payload() {
                @SuppressWarnings("unchecked")
                Class<? extends jakarta.validation.Payload>[] empty = new Class[0];
                return empty;
            }
        });
        return v;
    }

    @Test
    void null_passes_optional() {
        assertThat(validator(120).isValid(null, null)).isTrue();
    }

    @Test
    void today_is_valid() {
        assertThat(validator(120).isValid(TODAY, null)).isTrue();
    }

    @Test
    void tomorrow_is_rejected() {
        assertThat(validator(120).isValid(TODAY.plusDays(1), null)).isFalse();
    }

    @Test
    void a_normal_birthday_is_valid() {
        assertThat(validator(120).isValid(LocalDate.of(1990, 1, 1), null)).isTrue();
    }

    @Test
    void exactly_max_years_ago_is_valid() {
        assertThat(validator(120).isValid(TODAY.minusYears(120), null)).isTrue();
    }

    @Test
    void one_day_past_max_years_is_rejected() {
        assertThat(validator(120).isValid(TODAY.minusYears(120).minusDays(1), null)).isFalse();
    }

    @Test
    void year_1700_is_rejected() {
        assertThat(validator(120).isValid(LocalDate.of(1700, 1, 1), null)).isFalse();
    }
}
