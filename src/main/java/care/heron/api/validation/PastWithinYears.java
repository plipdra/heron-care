package care.heron.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@link java.time.LocalDate} as a date that must be in the past and no
 * more than {@code maxYears} ago — a sane human-lifespan window for a birthday.
 *
 * <p>Plain {@code @Past} rejects only the future; it would still accept the year
 * 1700. This constraint also caps how far back the date may be, so an absurd
 * birth year is rejected too. Today counts as valid (age 0). {@code null} passes
 * so optional / patch-style fields stay optional.
 */
@Documented
@Constraint(validatedBy = PastWithinYearsValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface PastWithinYears {

    String message() default "must be a real past date within range";

    /** Maximum age in years the date may represent (inclusive). */
    int maxYears() default 120;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
