package care.heron.api.dto.recommendation;

import care.heron.api.dto.doctor.PublicDoctorResponse;

// A recommended doctor + the specialty-domain reason for the match. Reuses the
// public doctor shape so the result card is the directory card plus one line.
public record RankedDoctorResponse(PublicDoctorResponse doctor, String reason) {}
