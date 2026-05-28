package care.heron.api.dto.patient;

import care.heron.api.validation.MeaningfulText;
import care.heron.api.validation.PastWithinYears;
import care.heron.api.validation.ValidPhone;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

// All fields nullable — patch-style update. Patients submit a subset of
// fields without clearing the rest.
public record UpdatePatientProfileRequest(
        @Size(max = 200, message = "name must not exceed 200 characters")
        @MeaningfulText(message = "name must contain readable text")
        String name,

        // A real past date within a human lifespan. Rejects the future and
        // absurd years (e.g. 1700, 2999) that a free-form date input can produce.
        @PastWithinYears(maxYears = 120, message = "birthday must be a real past date (age 0–120)")
        LocalDate birthday,

        @DecimalMin(value = "0.1", message = "weightKg must be greater than 0")
        @DecimalMax(value = "1000.0", message = "weightKg must be at most 1000")
        Double weightKg,

        @DecimalMin(value = "10.0", message = "heightCm must be at least 10")
        @DecimalMax(value = "300.0", message = "heightCm must be at most 300")
        Double heightCm,

        // Coarse length cap first, then real numbering-plan validation via
        // libphonenumber (default region PH, also accepts E.164 with a leading +).
        // Blank passes — the field is optional and a blank submit sends nothing.
        @Size(max = 30, message = "contactNumber must not exceed 30 characters")
        @ValidPhone(message = "contactNumber must be a valid Philippine phone number, e.g. +63 917 555 1234 or 09175551234")
        String contactNumber,

        @Size(max = 5000, message = "medicalHistory must not exceed 5000 characters")
        @MeaningfulText(message = "medicalHistory must contain readable text")
        String medicalHistory
) {}
