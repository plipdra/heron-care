package care.heron.api.dto.doctor;

import care.heron.api.document.enums.Specialization;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

// All fields nullable — patch-style update. Doctors can submit a subset of
// fields without clearing the rest.
public record UpdateDoctorProfileRequest(
        @Size(max = 200, message = "name must not exceed 200 characters")
        String name,

        @Size(max = 2000, message = "bio must not exceed 2000 characters")
        String bio,

        Specialization specialization,

        @Size(max = 500, message = "defaultMeetingLink must not exceed 500 characters")
        String defaultMeetingLink,

        @Min(value = 0, message = "yearsOfExperience must be at least 0")
        @Max(value = 70, message = "yearsOfExperience must not exceed 70")
        Integer yearsOfExperience
) {}
