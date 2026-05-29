package care.heron.api.dto.patient;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/*
 * Adversarial matrix for the patient profile patch DTO. Every field is optional
 * (patch-style), so the recurring theme is: blank/null passes, but a PRESENT
 * value must be sane. The phone field is the headline fix — it now goes through
 * libphonenumber, so the historic escapees ("1234567", "0000000", a 17-digit run)
 * are rejected while real PH numbers pass.
 */
class UpdatePatientProfileRequestValidationTest {

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

    // Maps the trailing `notes` arg onto notesForDoctor and leaves sex + the three
    // care lists null, so the existing phone/birthday/range/name cases are unchanged.
    private UpdatePatientProfileRequest req(String name, LocalDate birthday, Double weight,
                                            Double height, String phone, String notes) {
        return new UpdatePatientProfileRequest(
                name, birthday, null, weight, height, phone, null, null, null, notes);
    }

    private UpdatePatientProfileRequest withPhone(String phone) {
        return req(null, null, null, null, phone, null);
    }

    private UpdatePatientProfileRequest withConditions(List<String> conditions) {
        return new UpdatePatientProfileRequest(
                null, null, null, null, null, null, conditions, null, null, null);
    }

    private boolean fieldHasError(Set<? extends ConstraintViolation<?>> violations, String field) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    // Container-element violations carry a path like "conditions[0].<list element>",
    // so an exact match misses them — match on the leading property name instead.
    private boolean fieldPathStartsWith(Set<? extends ConstraintViolation<?>> violations, String prefix) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().startsWith(prefix));
    }

    @Test
    void empty_patch_is_valid() {
        assertThat(validator.validate(req(null, null, null, null, null, null))).isEmpty();
    }

    // ---- phone: libphonenumber, region PH + E.164 ----

    @ParameterizedTest
    @ValueSource(strings = {
            "+63 917 555 1234",  // E.164-ish PH mobile, spaced
            "+639175551234",     // E.164 PH mobile
            "09175551234",       // national-format PH mobile (region PH applied)
            "+63 2 8888 8888",   // PH (Manila) landline, international format
            "(02) 8888 8888",    // PH (Manila) landline, national format
    })
    void accepts_real_phone_numbers(String phone) {
        assertThat(fieldHasError(validator.validate(withPhone(phone)), "contactNumber")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "1234567",            // historic escapee: 7 digits, not a real number
            "0000000",            // historic escapee
            "1111111",            // historic escapee
            "12312342352435245",  // 17-digit run, past the E.164 cap
            "phone",              // letters
            "call me maybe",      // free text
            "++++",               // punctuation only
            "999",                // too short to be valid
    })
    void rejects_phone_garbage(String phone) {
        assertThat(fieldHasError(validator.validate(withPhone(phone)), "contactNumber")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "+12345678987",     // parses as a valid US/NANP number — but not PH
            "+1 650 253 0000",  // a real US number
            "+44 20 7946 0000", // UK
    })
    void rejects_valid_but_non_philippine_numbers(String phone) {
        // Heron is a Philippines-only service: a well-formed foreign number is
        // structurally valid yet out of region, so it must be rejected.
        assertThat(fieldHasError(validator.validate(withPhone(phone)), "contactNumber")).isTrue();
    }

    @Test
    void blank_phone_passes_optional() {
        assertThat(fieldHasError(validator.validate(withPhone("")), "contactNumber")).isFalse();
        assertThat(fieldHasError(validator.validate(withPhone("   ")), "contactNumber")).isFalse();
    }

    @Test
    void rejects_phone_over_30_chars_even_if_it_parsed() {
        String tooLong = "+63 917 555 1234 ext 0000000000000";
        assertThat(fieldHasError(validator.validate(withPhone(tooLong)), "contactNumber")).isTrue();
    }

    // ---- birthday: real past date, age 0–120 ----

    @Test
    void accepts_a_reasonable_past_birthday() {
        var violations = validator.validate(req(null, LocalDate.of(1990, 6, 15), null, null, null, null));
        assertThat(fieldHasError(violations, "birthday")).isFalse();
    }

    @Test
    void accepts_today_as_birthday() {
        var violations = validator.validate(req(null, LocalDate.now(), null, null, null, null));
        assertThat(fieldHasError(violations, "birthday")).isFalse();
    }

    @Test
    void rejects_future_birthday() {
        var violations = validator.validate(
                req(null, LocalDate.now().plusDays(1), null, null, null, null));
        assertThat(fieldHasError(violations, "birthday")).isTrue();
    }

    @Test
    void rejects_absurdly_old_birthday() {
        var violations = validator.validate(req(null, LocalDate.of(1700, 1, 1), null, null, null, null));
        assertThat(fieldHasError(violations, "birthday")).isTrue();
    }

    // ---- weight / height ranges ----

    @ParameterizedTest
    @ValueSource(doubles = {0.0, -5.0, 1000.1, 5000.0})
    void rejects_out_of_range_weight(double weight) {
        var violations = validator.validate(req(null, null, weight, null, null, null));
        assertThat(fieldHasError(violations, "weightKg")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.1, 70.0, 1000.0})
    void accepts_in_range_weight(double weight) {
        var violations = validator.validate(req(null, null, weight, null, null, null));
        assertThat(fieldHasError(violations, "weightKg")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 9.9, 300.1, -10.0})
    void rejects_out_of_range_height(double height) {
        var violations = validator.validate(req(null, null, null, height, null, null));
        assertThat(fieldHasError(violations, "heightCm")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(doubles = {10.0, 170.0, 300.0})
    void accepts_in_range_height(double height) {
        var violations = validator.validate(req(null, null, null, height, null, null));
        assertThat(fieldHasError(violations, "heightCm")).isFalse();
    }

    // ---- name / notesForDoctor: optional but, if present, meaningful + capped ----

    @Test
    void rejects_whitespace_only_name() {
        assertThat(fieldHasError(validator.validate(req("   ", null, null, null, null, null)), "name")).isTrue();
    }

    @Test
    void rejects_whitespace_only_notes_for_doctor() {
        assertThat(fieldHasError(
                validator.validate(req(null, null, null, null, null, " \t ")), "notesForDoctor")).isTrue();
    }

    @Test
    void accepts_real_notes_for_doctor() {
        var violations = validator.validate(
                req(null, null, null, null, null, "Prefers afternoon consults."));
        assertThat(fieldHasError(violations, "notesForDoctor")).isFalse();
    }

    @Test
    void rejects_notes_for_doctor_over_2000_chars() {
        var violations = validator.validate(
                req(null, null, null, null, null, "x".repeat(2001)));
        assertThat(fieldHasError(violations, "notesForDoctor")).isTrue();
    }

    // ---- care lists (conditions/allergies/medications): each entry meaningful +
    // capped, and a bounded number of entries. Same constraints across all three;
    // conditions stands in for the matrix, with a smoke check that the others apply. ----

    @Test
    void accepts_a_real_conditions_list() {
        var violations = validator.validate(withConditions(List.of("Hypertension", "Mild asthma")));
        assertThat(fieldPathStartsWith(violations, "conditions")).isFalse();
    }

    @Test
    void empty_conditions_list_is_valid() {
        assertThat(fieldPathStartsWith(validator.validate(withConditions(List.of())), "conditions")).isFalse();
    }

    @Test
    void rejects_a_whitespace_only_condition_entry() {
        // Arrays.asList allows the junk string List.of would still permit; the
        // element-level @MeaningfulText must reject a tag that is only whitespace.
        var violations = validator.validate(withConditions(Arrays.asList("Hypertension", "   ")));
        assertThat(fieldPathStartsWith(violations, "conditions")).isTrue();
    }

    @Test
    void rejects_an_overlong_condition_entry() {
        var violations = validator.validate(withConditions(List.of("x".repeat(201))));
        assertThat(fieldPathStartsWith(violations, "conditions")).isTrue();
    }

    @Test
    void rejects_too_many_condition_entries() {
        List<String> tooMany = java.util.stream.IntStream.range(0, 51)
                .mapToObj(i -> "Condition " + i).toList();
        assertThat(fieldHasError(validator.validate(withConditions(tooMany)), "conditions")).isTrue();
    }

    @Test
    void allergies_and_medications_apply_the_same_element_rule() {
        var allergyViolations = validator.validate(new UpdatePatientProfileRequest(
                null, null, null, null, null, null, null, Arrays.asList("  "), null, null));
        assertThat(fieldPathStartsWith(allergyViolations, "allergies")).isTrue();

        var medViolations = validator.validate(new UpdatePatientProfileRequest(
                null, null, null, null, null, null, null, null, Arrays.asList("\t"), null));
        assertThat(fieldPathStartsWith(medViolations, "medications")).isTrue();
    }
}
