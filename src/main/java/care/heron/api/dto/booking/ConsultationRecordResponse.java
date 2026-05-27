package care.heron.api.dto.booking;

import care.heron.api.document.ConsultationRecord;

import java.time.Instant;
import java.util.List;

// The finalized consultation record as read by the patient or the doctor. Only
// ever returned from the booking-scoped GET /api/bookings/{id}/notes, never from
// a list payload (info-minimization — a list must not ship everyone's diagnosis).
public record ConsultationRecordResponse(
        String subjective,
        String objective,
        String assessment,
        String plan,
        List<PrescriptionItemResponse> prescription,
        Instant finalizedAt
) {
    public record PrescriptionItemResponse(String medication, String dosage, String instructions) {}

    public static ConsultationRecordResponse from(ConsultationRecord record) {
        List<PrescriptionItemResponse> items = record.getPrescription() == null
                ? List.of()
                : record.getPrescription().stream()
                        .map(i -> new PrescriptionItemResponse(
                                i.getMedication(), i.getDosage(), i.getInstructions()))
                        .toList();
        return new ConsultationRecordResponse(
                record.getSubjective(),
                record.getObjective(),
                record.getAssessment(),
                record.getPlan(),
                items,
                record.getFinalizedAt());
    }
}
