package care.heron.api.service.recommendation;

import care.heron.api.document.enums.Specialization;

// The patient-facing rationale for a match — shared by the rules and LLM
// strategies so the safety-critical wording can't drift. Framed around the
// SPECIALTY's domain, never the patient's condition, and never a score: this is
// what keeps the recommendation "a doctor type, not a diagnosis."
final class SpecialtyReasons {

    private SpecialtyReasons() {}

    static String reasonFor(Specialization specialization) {
        return switch (specialization) {
            case CARDIOLOGY -> "Cardiologists focus on the heart and chest-related concerns.";
            case DERMATOLOGY -> "Dermatologists handle skin, hair, and nail concerns.";
            case PSYCHIATRY -> "Psychiatrists support mental health and mood concerns.";
            case NEUROLOGY -> "Neurologists focus on the nervous system, including headaches and dizziness.";
            case OB_GYN -> "OB-GYNs care for reproductive and pregnancy-related health.";
            case PEDIATRICS -> "Pediatricians care for infants, children, and teens.";
            case ORTHOPEDICS -> "Orthopedic doctors handle bones, joints, and muscles.";
            case ENDOCRINOLOGY -> "Endocrinologists manage hormones, the thyroid, and diabetes.";
            case INTERNAL_MEDICINE -> "Internal medicine doctors handle a broad range of adult health concerns.";
            case GENERAL_PRACTICE -> "A general practice doctor is a good starting point and can refer you onward.";
        };
    }
}
