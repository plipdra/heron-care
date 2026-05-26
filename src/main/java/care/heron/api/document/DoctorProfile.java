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

    private String profilePicturePath;

    private String defaultMeetingLink;

    private Integer yearsOfExperience;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
