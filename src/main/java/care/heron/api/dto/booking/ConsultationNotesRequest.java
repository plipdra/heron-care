package care.heron.api.dto.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

// What a doctor submits to save consultation notes. `finalize` distinguishes a
// private draft (false — keep editing later, patient can't see it) from
// finalizing (true — lock the record, mark the visit complete, share with the
// patient). All content fields optional but size-capped, since the record embeds
// in the Booking document.
public record ConsultationNotesRequest(
        @Size(max = 4000, message = "Subjective must not exceed 4000 characters.")
        String subjective,
        @Size(max = 4000, message = "Objective must not exceed 4000 characters.")
        String objective,
        @Size(max = 4000, message = "Assessment must not exceed 4000 characters.")
        String assessment,
        @Size(max = 4000, message = "Plan must not exceed 4000 characters.")
        String plan,
        @Valid
        @Size(max = 30, message = "A prescription can have at most 30 items.")
        List<PrescriptionItemRequest> prescription,
        boolean finalise
) {
    public record PrescriptionItemRequest(
            @Size(max = 200, message = "Medication name must not exceed 200 characters.")
            String medication,
            @Size(max = 200, message = "Dosage must not exceed 200 characters.")
            String dosage,
            @Size(max = 500, message = "Instructions must not exceed 500 characters.")
            String instructions
    ) {}
}
