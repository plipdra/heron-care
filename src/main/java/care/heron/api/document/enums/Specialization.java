package care.heron.api.document.enums;

public enum Specialization {
    GENERAL_PRACTICE("General Practice"),
    INTERNAL_MEDICINE("Internal Medicine"),
    PEDIATRICS("Pediatrics"),
    OB_GYN("OB-GYN"),
    CARDIOLOGY("Cardiology"),
    DERMATOLOGY("Dermatology"),
    PSYCHIATRY("Psychiatry"),
    NEUROLOGY("Neurology"),
    ORTHOPEDICS("Orthopedics"),
    ENDOCRINOLOGY("Endocrinology");

    private final String displayName;

    Specialization(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}
