package care.heron.api.document;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import care.heron.api.document.enums.Sex;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document("patient_profiles")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PatientProfile {

    @Id
    private String id;

    private String userId;

    private String name;

    // Populated by the patient profile editor. All optional; patients fill
    // progressively. Profile picture lives in a separate collection (see
    // ProfilePicture) so list responses never accidentally ship picture
    // bytes. "Contact Details" per spec is a single phone number — address
    // is out of scope for a telehealth MVP.
    private LocalDate birthday;
    private Sex sex;
    private Double weightKg;
    private Double heightCm;
    private String contactNumber;

    // Structured care profile — replaces the former free-text medicalHistory.
    // Each list holds short entries the patient manages as removable tags in
    // the editor (e.g. "Hypertension", "Penicillin", "Losartan 50mg daily");
    // notesForDoctor is a free-text note surfaced to the clinician before a
    // consult. All optional — a blank list/null renders as "Not provided".
    private List<String> conditions;
    private List<String> allergies;
    private List<String> medications;
    private String notesForDoctor;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
