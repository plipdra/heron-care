package care.heron.api.document;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

// Embedded on Booking — the doctor's record of one consultation. SOAP fields
// (the standard clinical note structure) plus a structured prescription. Lives
// inside the Booking because a consult record has no life independent of its
// consult. Written and finalized in one action: finalizedAt is set, the booking
// goes COMPLETED, and the record is then patient-visible and locked (no in-place
// edits — amendments are Future Work).
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConsultationRecord {

    private String subjective;
    private String objective;
    private String assessment;
    private String plan;

    private List<PrescriptionItem> prescription;

    private Instant finalizedAt;

    @Getter
    @Setter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class PrescriptionItem {
        private String medication;
        private String dosage;
        private String instructions;
    }
}
