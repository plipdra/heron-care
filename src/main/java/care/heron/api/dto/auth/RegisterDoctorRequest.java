package care.heron.api.dto.auth;

import care.heron.api.document.enums.Specialization;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterDoctorRequest(
        @Email(message = "must be a valid email")
        @NotBlank(message = "email is required")
        String email,

        @NotBlank(message = "password is required")
        @Size(min = 8, max = 100, message = "password must be between 8 and 100 characters")
        String password,

        @NotBlank(message = "name is required")
        @Size(min = 1, max = 200, message = "name must be between 1 and 200 characters")
        String name,

        @NotNull(message = "specialization is required")
        Specialization specialization
) {}
