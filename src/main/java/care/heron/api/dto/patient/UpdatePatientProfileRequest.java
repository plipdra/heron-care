package care.heron.api.dto.patient;

import care.heron.api.document.enums.Sex;
import care.heron.api.validation.MeaningfulText;
import care.heron.api.validation.PastWithinYears;
import care.heron.api.validation.ValidPhone;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

// All fields nullable — patch-style update. Patients submit a subset of
// fields without clearing the rest. The care lists carry container-element
// constraints (each entry size-capped and meaningful) plus a cap on entry
// count, so a malformed tag is rejected element-by-element, not just in bulk.
public record UpdatePatientProfileRequest(
        @Size(max = 200, message = "name must not exceed 200 characters")
        @MeaningfulText(message = "name must contain readable text")
        String name,

        // A real past date within a human lifespan. Rejects the future and
        // absurd years (e.g. 1700, 2999) that a free-form date input can produce.
        @PastWithinYears(maxYears = 120, message = "birthday must be a real past date (age 0–120)")
        LocalDate birthday,

        Sex sex,

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

        @Size(max = 50, message = "conditions must not exceed 50 entries")
        List<@Size(max = 200, message = "each condition must not exceed 200 characters")
             @MeaningfulText(message = "each condition must contain readable text") String> conditions,

        @Size(max = 50, message = "allergies must not exceed 50 entries")
        List<@Size(max = 200, message = "each allergy must not exceed 200 characters")
             @MeaningfulText(message = "each allergy must contain readable text") String> allergies,

        @Size(max = 50, message = "medications must not exceed 50 entries")
        List<@Size(max = 200, message = "each medication must not exceed 200 characters")
             @MeaningfulText(message = "each medication must contain readable text") String> medications,

        @Size(max = 2000, message = "notesForDoctor must not exceed 2000 characters")
        @MeaningfulText(message = "notesForDoctor must contain readable text")
        String notesForDoctor
) {}
