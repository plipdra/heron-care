package care.heron.api.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Login deliberately does NOT enforce the strict signup email shape: an account
// that already exists must always be able to sign in, and a too-strict format
// check here would lock out a legitimate user over a cosmetic mismatch. We only
// require the fields to be present and sanely bounded; the credential check
// (and the 401 on mismatch) is the real gate.
public record LoginRequest(
        @NotBlank(message = "email is required")
        @Size(max = 254, message = "email must not exceed 254 characters")
        String email,

        @NotBlank(message = "password is required")
        @Size(max = 200, message = "password must not exceed 200 characters")
        String password
) {}
