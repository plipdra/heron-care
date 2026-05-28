package care.heron.api.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Backs {@link MeaningfulText}. Passes null and empty (field stays optional).
 * For a non-empty value, requires at least one character that is neither
 * whitespace nor an ISO control character — otherwise the "text" is junk.
 */
public class MeaningfulTextValidator implements ConstraintValidator<MeaningfulText, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Optional: absent or empty is fine. A whitespace/control-only value is not.
        if (value == null || value.isEmpty()) {
            return true;
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (!Character.isWhitespace(c) && !Character.isISOControl(c)) {
                return true;
            }
        }
        return false;
    }
}
