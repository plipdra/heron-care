package care.heron.api.document;

import care.heron.api.document.enums.Specialization;
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

import java.time.Instant;

@Document("doctor_profiles")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DoctorProfile {

    @Id
    private String id;

    private String userId;

    private String name;

    private String bio;

    private Specialization specialization;

    private String defaultMeetingLink;

    private Integer yearsOfExperience;

    // PRC (Professional Regulation Commission) license + PTR (Professional Tax
    // Receipt) numbers. Captured at doctor registration (auto-generated for the
    // demo) and rendered as real stored values on the printable prescription
    // and visit summary, which name the prescribing clinician's credentials.
    private String prcLicenseNo;
    private String ptrNo;

    // Embedded — schedule rules and blocked ranges live with the doctor
    // because they don't have independent lifecycle. Slot listing reads
    // this and derives available 30-min slots on the fly.
    private Availability availability;

    // Public-listing gate. A doctor appears in discovery + AI recommendations
    // only when their profile is complete enough to be credible and bookable
    // (set by the service on save via ProfileCompleteness). Defaults false, so
    // an incomplete or test account stays out of public surfaces until finished.
    private boolean published;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
