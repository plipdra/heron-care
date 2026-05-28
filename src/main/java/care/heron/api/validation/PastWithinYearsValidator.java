package care.heron.api.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.time.Clock;
import java.time.LocalDate;

/**
 * Backs {@link PastWithinYears}. Valid when the date is not in the future and is
 * within {@code maxYears} of today. Uses the JVM's local zone so "today" matches
 * the user's calendar day — comparing against UTC would reject a user's genuine
 * local today during the hours their date is ahead of UTC.
 */
public class PastWithinYearsValidator implements ConstraintValidator<PastWithinYears, LocalDate> {

    private final Clock clock;
    private int maxYears;

    // Default constructor used by the Bean Validation provider.
    public PastWithinYearsValidator() {
        this(Clock.systemDefaultZone());
    }

    // Visible for testing with a fixed clock.
    PastWithinYearsValidator(Clock clock) {
        this.clock = clock;
    }

    @Override
    public void initialize(PastWithinYears annotation) {
        this.maxYears = annotation.maxYears();
    }

    @Override
    public boolean isValid(LocalDate value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }
        LocalDate today = LocalDate.now(clock);
        if (value.isAfter(today)) {
            return false;
        }
        LocalDate earliest = today.minusYears(maxYears);
        return !value.isBefore(earliest);
    }
}
