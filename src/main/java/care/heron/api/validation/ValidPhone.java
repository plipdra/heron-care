package care.heron.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a String field as a phone number that must be valid against a real
 * numbering plan AND belong to the configured region (Philippines). Backed by
 * {@link PhoneValidator}: locally-formatted numbers like {@code 09175551234} and
 * {@code +63 …} validate; a well-formed foreign number (e.g. {@code +1 …}) does
 * not, because Heron is a Philippines service.
 *
 * <p>The field is treated as optional: {@code null} or blank passes. This keeps
 * patch-style profile updates and unfilled optional fields working. To require
 * a value, combine with {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = PhoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPhone {

    String message() default "Enter a valid Philippine phone number, e.g. +63 917 555 1234 or 09175551234.";

    /** ISO 3166-1 alpha-2 region used to parse numbers without a country code. */
    String region() default "PH";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
