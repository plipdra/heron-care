package care.heron.api.dto.auth;

import care.heron.api.document.enums.Specialization;
import care.heron.api.validation.MeaningfulText;
import care.heron.api.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterDoctorRequest(
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
        String name,

        @NotNull(message = "specialization is required")
        Specialization specialization,

        // Optional at the API — the signup form pre-fills generated values for the
        // demo, and AuthService generates a fallback if either arrives blank, so a
        // doctor always has license numbers for the printable documents. Real PRC
        // verification is Future Work (see AuthController).
        @Size(max = 40, message = "prcLicenseNo must not exceed 40 characters")
        String prcLicenseNo,

        @Size(max = 40, message = "ptrNo must not exceed 40 characters")
        String ptrNo
) {}
