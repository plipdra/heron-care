package care.heron.api.dto.recommendation;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/*
 * Adversarial matrix for the AI recommendation intake. `concern` is required,
 * capped, and must be readable text (not whitespace/control-char filler that a
 * bare @NotBlank+@Size could miss). The step-2 refiners are optional but bounded.
 */
class RecommendationRequestValidationTest {

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

    @Test
    void accepts_a_real_concern() {
        var req = new RecommendationRequest("Chest tightness when climbing stairs.", null, null);
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void accepts_concern_with_optional_refiners() {
        var req = new RecommendationRequest("Skin rash on arms.", "CHILD", "3 days");
        assertThat(validator.validate(req)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "\t\n"})
    void rejects_blank_or_whitespace_concern(String concern) {
        assertThat(fieldHasError(validator.validate(
                new RecommendationRequest(concern, null, null)), "concern")).isTrue();
    }

    @Test
    void rejects_null_concern() {
        assertThat(fieldHasError(validator.validate(
                new RecommendationRequest(null, null, null)), "concern")).isTrue();
    }

    @Test
    void rejects_control_char_only_concern() {
        // SOH/STX are not whitespace, so @NotBlank alone would let them through;
        // @MeaningfulText catches a control-char-only payload. Built from char
        // codes so the source file carries no literal control bytes.
        String controlOnly = "" + (char) 1 + (char) 2 + (char) 1;
        assertThat(fieldHasError(validator.validate(
                new RecommendationRequest(controlOnly, null, null)), "concern")).isTrue();
    }

    @Test
    void rejects_concern_over_1000_chars() {
        assertThat(fieldHasError(validator.validate(
                new RecommendationRequest("x".repeat(1001), null, null)), "concern")).isTrue();
    }

    @Test
    void rejects_oversized_refiners() {
        var req = new RecommendationRequest("Headache.", "x".repeat(101), "y".repeat(101));
        var violations = validator.validate(req);
        assertThat(fieldHasError(violations, "forWhom")).isTrue();
        assertThat(fieldHasError(violations, "duration")).isTrue();
    }
}
