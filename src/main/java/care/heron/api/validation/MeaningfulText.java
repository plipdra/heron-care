package care.heron.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * For optional free-text fields that, IF provided, must actually carry content.
 * It does NOT make the field required — {@code null} and {@code ""} pass, so an
 * unfilled or cleared field stays valid. But a value that is only whitespace or
 * only control characters (e.g. {@code "   "}, a lone tab, a zero-width run) is
 * rejected: that is junk masquerading as text, the class of input that slips past
 * a bare {@code @Size} cap.
 *
 * <p>Use this on bio / concernNote / notesForDoctor / a patch-style name where the
 * field is optional. For a required text field, use {@code @NotBlank} instead.
 * TYPE_USE is included so it can also constrain the elements of a collection,
 * e.g. {@code List<@MeaningfulText String>} (the structured care lists).
 */
@Documented
@Constraint(validatedBy = MeaningfulTextValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface MeaningfulText {

    String message() default "must contain readable text, not only spaces or control characters";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
