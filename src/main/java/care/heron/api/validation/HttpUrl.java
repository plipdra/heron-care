package care.heron.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a String as an http(s) URL when present. Used for the doctor's meeting
 * link, which the patient is shown as a clickable join URL — so {@code javascript:}
 * URIs, bare hostnames, and "not a url at all" must be rejected, leaving only a
 * real {@code http://} / {@code https://} address.
 *
 * <p>{@code null} or blank passes (optional field). Pair with {@code @NotBlank}
 * to require a value.
 */
@Documented
@Constraint(validatedBy = HttpUrlValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface HttpUrl {

    String message() default "must be a valid http(s) URL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
