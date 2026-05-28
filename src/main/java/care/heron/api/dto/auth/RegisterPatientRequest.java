package care.heron.api.dto.auth;

import care.heron.api.validation.MeaningfulText;
import care.heron.api.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterPatientRequest(
        @NotBlank(message = "email is required")
        // @Email alone accepts "a@b" (no TLD); require a dotted domain so a
        // real address shape is enforced at signup.
        @Email(
                regexp = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
                message = "must be a valid email, e.g. you@example.com")
        @Size(max = 254, message = "email must not exceed 254 characters")
        String email,

        // @StrongPassword covers null/length/letter+digit. The documented demo
        // password Demo123! satisfies it; the seed bypasses this DTO entirely.
        @StrongPassword
        String password,

        @NotBlank(message = "name is required")
        @Size(max = 200, message = "name must be between 1 and 200 characters")
        @MeaningfulText(message = "name must contain readable text")
        String name
) {}
