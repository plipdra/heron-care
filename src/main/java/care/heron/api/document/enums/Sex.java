package care.heron.api.document.enums;

// Patient biological sex, shown on the profile and the printable clinical
// documents (visit summary, prescription). Stored as an enum so the value set
// is fixed and the display label is a single source of truth, mirroring
// Specialization. Optional on the profile — UNSPECIFIED covers a blank choice.
public enum Sex {
    MALE("Male"),
    FEMALE("Female"),
    OTHER("Other"),
    UNSPECIFIED("Prefer not to say");

    private final String displayName;

    Sex(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}
