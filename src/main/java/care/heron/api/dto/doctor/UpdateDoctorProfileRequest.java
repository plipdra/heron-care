package care.heron.api.dto.doctor;

import care.heron.api.document.enums.Specialization;
import care.heron.api.validation.HttpUrl;
import care.heron.api.validation.MeaningfulText;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

// All fields nullable — patch-style update. Doctors can submit a subset of
// fields without clearing the rest.
public record UpdateDoctorProfileRequest(
        @Size(max = 200, message = "name must not exceed 200 characters")
        @MeaningfulText(message = "name must contain readable text")
        String name,

        @Size(max = 2000, message = "bio must not exceed 2000 characters")
        @MeaningfulText(message = "bio must contain readable text")
        String bio,

        Specialization specialization,

        // Patients click this to join the consultation, so it must be a real
        // http(s) URL when present (no javascript:, no bare hostname).
        @Size(max = 500, message = "defaultMeetingLink must not exceed 500 characters")
        @HttpUrl(message = "defaultMeetingLink must be a valid http(s) URL")
        String defaultMeetingLink,

        @Min(value = 0, message = "yearsOfExperience must be at least 0")
        @Max(value = 70, message = "yearsOfExperience must not exceed 70")
        Integer yearsOfExperience
) {}
