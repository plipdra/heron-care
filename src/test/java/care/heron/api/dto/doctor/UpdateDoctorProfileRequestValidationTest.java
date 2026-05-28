package care.heron.api.dto.doctor;

import care.heron.api.document.enums.Specialization;
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
 * Adversarial matrix for the doctor profile patch DTO. The headline field is
 * defaultMeetingLink: patients click it to join a consultation, so a bad scheme
 * (javascript:), a bare hostname, or junk must be rejected — only real http(s)
 * URLs pass. yearsOfExperience is bounded 0–70; name/bio are optional but must
 * carry text if present.
 */
class UpdateDoctorProfileRequestValidationTest {

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

    private UpdateDoctorProfileRequest req(String name, String bio, Specialization spec,
                                           String link, Integer years) {
        return new UpdateDoctorProfileRequest(name, bio, spec, link, years);
    }

    private UpdateDoctorProfileRequest withLink(String link) {
        return req(null, null, null, link, null);
    }

    private boolean fieldHasError(Set<? extends ConstraintViolation<?>> violations, String field) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    @Test
    void empty_patch_is_valid() {
        assertThat(validator.validate(req(null, null, null, null, null))).isEmpty();
    }

    // ---- defaultMeetingLink: http(s) only ----

    @ParameterizedTest
    @ValueSource(strings = {
            "https://meet.google.com/abc-defg-hij",
            "https://zoom.us/j/1234567890",
            "http://example.com/room",
            "https://teams.microsoft.com/l/meetup-join/xyz",
    })
    void accepts_real_http_links(String link) {
        assertThat(fieldHasError(validator.validate(withLink(link)), "defaultMeetingLink")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "javascript:alert(1)",      // dangerous scheme
            "ftp://example.com/file",    // wrong scheme
            "mailto:doc@heron.care",     // wrong scheme
            "meet.google.com/abc",       // bare hostname, no scheme
            "not a url",                 // junk
            "://missing-scheme.com",     // malformed
            "http://",                   // scheme but no host
    })
    void rejects_non_http_or_malformed_links(String link) {
        assertThat(fieldHasError(validator.validate(withLink(link)), "defaultMeetingLink")).isTrue();
    }

    @Test
    void blank_link_passes_optional() {
        assertThat(fieldHasError(validator.validate(withLink("")), "defaultMeetingLink")).isFalse();
        assertThat(fieldHasError(validator.validate(withLink("  ")), "defaultMeetingLink")).isFalse();
    }

    @Test
    void rejects_link_over_500_chars() {
        String tooLong = "https://example.com/" + "x".repeat(500);
        assertThat(fieldHasError(validator.validate(withLink(tooLong)), "defaultMeetingLink")).isTrue();
    }

    // ---- yearsOfExperience: 0–70 ----

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 35, 70})
    void accepts_years_in_range(int years) {
        assertThat(fieldHasError(validator.validate(req(null, null, null, null, years)),
                "yearsOfExperience")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 71, 200, 1000})
    void rejects_years_out_of_range(int years) {
        assertThat(fieldHasError(validator.validate(req(null, null, null, null, years)),
                "yearsOfExperience")).isTrue();
    }

    // ---- name / bio: optional but meaningful + capped ----

    @Test
    void rejects_whitespace_only_name_and_bio() {
        assertThat(fieldHasError(validator.validate(req("  ", null, null, null, null)), "name")).isTrue();
        assertThat(fieldHasError(validator.validate(req(null, "\t\n", null, null, null)), "bio")).isTrue();
    }

    @Test
    void rejects_bio_over_2000_chars() {
        assertThat(fieldHasError(validator.validate(req(null, "b".repeat(2001), null, null, null)),
                "bio")).isTrue();
    }

    @Test
    void accepts_full_valid_profile() {
        var req = req("Dr Reyes", "Board-certified cardiologist.",
                Specialization.CARDIOLOGY, "https://meet.google.com/abc-defg-hij", 12);
        assertThat(validator.validate(req)).isEmpty();
    }
}
