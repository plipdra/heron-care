package care.heron.api.validation;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber.PhoneNumber;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validates a phone number with Google's libphonenumber rather than a hand-rolled
 * regex. The regex approach we used before could only count digits, so it passed
 * garbage like {@code 1234567} (7 digits, but not a real number) and {@code 0000000}.
 * libphonenumber checks the value against the region's actual numbering plan via
 * {@link PhoneNumberUtil#isValidNumber}, which knows valid PH mobile prefixes
 * (09xx / +639xx) and landline area codes.
 *
 * <p>Parsing strategy: the configured default region (PH) is used for numbers
 * written in national format (e.g. {@code 09175551234}); a leading {@code +} is
 * parsed as E.164 by its country code. The number must be valid AND belong to the
 * configured region, so {@code +63 …}/{@code 09…}/PH landlines pass while a
 * well-formed foreign number (e.g. a {@code +1 …} US number) is rejected — Heron
 * is a Philippines service. Blank / null is allowed — the field is optional.
 */
public class PhoneValidator implements ConstraintValidator<ValidPhone, String> {

    private static final PhoneNumberUtil PHONE_UTIL = PhoneNumberUtil.getInstance();

    private String region;

    @Override
    public void initialize(ValidPhone annotation) {
        this.region = annotation.region();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Optional field: empty/blank passes. Pair with @NotBlank to require it.
        if (value == null || value.isBlank()) {
            return true;
        }
        try {
            PhoneNumber parsed = PHONE_UTIL.parse(value.trim(), region);
            // Valid AND in the configured region (PH) — a well-formed foreign
            // number must not pass for a Philippines-only service.
            return PHONE_UTIL.isValidNumberForRegion(parsed, region);
        } catch (NumberParseException e) {
            // Letters, too few digits to parse, malformed input — not a number.
            return false;
        }
    }
}
