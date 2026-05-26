package care.heron.api.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @Email(message = "must be a valid email")
        @NotBlank(message = "email is required")
        String email,

        @NotBlank(message = "password is required")
        String password
) {}
