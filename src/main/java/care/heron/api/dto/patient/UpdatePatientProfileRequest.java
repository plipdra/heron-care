package care.heron.api.dto.patient;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

// All fields nullable — patch-style update. Patients submit a subset of
// fields without clearing the rest.
public record UpdatePatientProfileRequest(
        @Size(max = 200, message = "name must not exceed 200 characters")
        String name,

        LocalDate birthday,

        @DecimalMin(value = "0.1", message = "weightKg must be greater than 0")
        @DecimalMax(value = "1000.0", message = "weightKg must be at most 1000")
        Double weightKg,

        @DecimalMin(value = "10.0", message = "heightCm must be at least 10")
        @DecimalMax(value = "300.0", message = "heightCm must be at most 300")
        Double heightCm,

        @Size(max = 30, message = "contactNumber must not exceed 30 characters")
        @Pattern(
                regexp = "^[+0-9 ()-]*$",
                message = "contactNumber may contain digits, spaces, +, -, and parentheses only")
        String contactNumber,

        @Size(max = 5000, message = "medicalHistory must not exceed 5000 characters")
        String medicalHistory
) {}
