package care.heron.api.dto.auth;

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
 * Adversarial validation matrix for the auth request DTOs. Drives the jakarta
 * Validator directly (no Spring context) so every field's constraint is exercised
 * in isolation — the same constraints @Valid enforces at the controller. Each
 * field has its valid baseline plus the garbage that MUST be rejected.
 *
 * The class-of-bug guard: we don't test one bad password and call it done; we
 * sweep the whole policy (too short, no digit, no letter, over the bcrypt cap)
 * and pin the documented demo password as permanently valid.
 */
class AuthRequestValidationTest {

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

    private RegisterPatientRequest patient(String email, String password, String name) {
        return new RegisterPatientRequest(email, password, name);
    }

    private RegisterDoctorRequest doctor(String email, String password, String name) {
        return new RegisterDoctorRequest(email, password, name, Specialization.GENERAL_PRACTICE);
    }

    private boolean fieldHasError(Set<? extends ConstraintViolation<?>> violations, String field) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    // ---- email (signup): proper shape required ----

    @ParameterizedTest
    @ValueSource(strings = {"a@b.co", "patient@heron.care", "first.last+tag@sub.example.com"})
    void accepts_real_emails(String email) {
        var violations = validator.validate(patient(email, "Demo123!", "Ana"));
        assertThat(fieldHasError(violations, "email")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "a@", "a@b", "a b@c.com", "two@@at.com", "no spaces@x.com"})
    void rejects_malformed_emails(String email) {
        var violations = validator.validate(patient(email, "Demo123!", "Ana"));
        assertThat(fieldHasError(violations, "email")).isTrue();
    }

    @Test
    void rejects_blank_email() {
        assertThat(fieldHasError(validator.validate(patient("", "Demo123!", "Ana")), "email")).isTrue();
        assertThat(fieldHasError(validator.validate(patient("   ", "Demo123!", "Ana")), "email")).isTrue();
    }

    @Test
    void rejects_absurdly_long_email() {
        String local = "a".repeat(250);
        var violations = validator.validate(patient(local + "@b.co", "Demo123!", "Ana"));
        assertThat(fieldHasError(violations, "email")).isTrue();
    }

    // ---- password (signup): 8–72, letter + digit ----

    @Test
    void documented_demo_password_stays_valid() {
        // Demo123! is published in the README and used by the seed. It must pass.
        var violations = validator.validate(patient("a@b.co", "Demo123!", "Ana"));
        assertThat(fieldHasError(violations, "password")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"abcd1234", "password1", "A1aaaaaa", "longishpassw0rd"})
    void accepts_passwords_with_a_letter_and_a_digit_and_min_length(String password) {
        var violations = validator.validate(patient("a@b.co", password, "Ana"));
        assertThat(fieldHasError(violations, "password")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Ab1",        // too short
            "Demo12!",    // 7 chars, too short
            "abcdefgh",   // no digit
            "12345678",   // no letter
            "!@#$%^&*",    // neither letter nor digit
    })
    void rejects_weak_passwords(String password) {
        var violations = validator.validate(patient("a@b.co", password, "Ana"));
        assertThat(fieldHasError(violations, "password")).isTrue();
    }

    @Test
    void rejects_password_over_bcrypt_limit() {
        String tooLong = "a1" + "x".repeat(71); // 73 chars
        var violations = validator.validate(patient("a@b.co", tooLong, "Ana"));
        assertThat(fieldHasError(violations, "password")).isTrue();
    }

    @Test
    void accepts_password_exactly_at_72() {
        String at72 = "a1" + "x".repeat(70); // 72 chars
        var violations = validator.validate(patient("a@b.co", at72, "Ana"));
        assertThat(fieldHasError(violations, "password")).isFalse();
    }

    @Test
    void rejects_null_password() {
        var violations = validator.validate(patient("a@b.co", null, "Ana"));
        assertThat(fieldHasError(violations, "password")).isTrue();
    }

    // ---- name ----

    @Test
    void rejects_blank_and_whitespace_only_name() {
        assertThat(fieldHasError(validator.validate(patient("a@b.co", "Demo123!", "")), "name")).isTrue();
        assertThat(fieldHasError(validator.validate(patient("a@b.co", "Demo123!", "   ")), "name")).isTrue();
        assertThat(fieldHasError(validator.validate(patient("a@b.co", "Demo123!", "\t\n")), "name")).isTrue();
    }

    @Test
    void rejects_name_over_200_chars() {
        var violations = validator.validate(patient("a@b.co", "Demo123!", "n".repeat(201)));
        assertThat(fieldHasError(violations, "name")).isTrue();
    }

    @Test
    void accepts_normal_name() {
        var violations = validator.validate(patient("a@b.co", "Demo123!", "Maria Clara"));
        assertThat(fieldHasError(violations, "name")).isFalse();
    }

    // ---- doctor: specialization required, same email/password/name rules ----

    @Test
    void doctor_register_requires_specialization() {
        var req = new RegisterDoctorRequest("a@b.co", "Demo123!", "Dr A", null);
        assertThat(fieldHasError(validator.validate(req), "specialization")).isTrue();
    }

    @Test
    void doctor_register_valid_baseline_has_no_violations() {
        assertThat(validator.validate(doctor("dr@heron.care", "Demo123!", "Dr A"))).isEmpty();
    }

    // ---- login: present-but-not-format-strict ----

    @Test
    void login_requires_both_fields_present() {
        assertThat(validator.validate(new LoginRequest("", "x")))
                .anyMatch(v -> v.getPropertyPath().toString().equals("email"));
        assertThat(validator.validate(new LoginRequest("a@b.co", "")))
                .anyMatch(v -> v.getPropertyPath().toString().equals("password"));
    }

    @Test
    void login_does_not_enforce_strict_email_shape() {
        // A pre-existing account must still be able to sign in; login only checks
        // presence + length, never the strict signup format.
        assertThat(validator.validate(new LoginRequest("legacy-user", "whatever"))).isEmpty();
    }

    @Test
    void login_accepts_the_demo_credentials() {
        assertThat(validator.validate(new LoginRequest("patient@heron.care", "Demo123!"))).isEmpty();
    }
}
