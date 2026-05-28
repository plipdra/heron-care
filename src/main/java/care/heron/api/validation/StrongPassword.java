package care.heron.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Signup password policy: 8–72 characters with at least one letter and at least
 * one digit. The 72-char ceiling matches bcrypt's input limit (bytes beyond 72
 * are silently ignored by the encoder, so accepting more would be misleading).
 * Intentionally not draconian — no symbol/case requirements — but enough to stop
 * trivially weak passwords. The documented demo password {@code Demo123!} passes.
 *
 * <p>Applied only to signup DTOs. Login does not re-check policy (an existing
 * account must still be able to sign in), and the seed creates users through the
 * encoder directly, bypassing this constraint.
 */
@Documented
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {

    String message() default "Password must be 8–72 characters and include at least one letter and one number.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
