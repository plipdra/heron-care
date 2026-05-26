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

import java.time.Instant;

// Stored separately from PatientProfile / DoctorProfile so list endpoints
// (e.g., paginated doctor discovery) never accidentally ship picture bytes.
// The byte-serving endpoint reads from here directly; profile JSON exposes
// a derived URL only.
@Document("profile_pictures")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProfilePicture {

    @Id
    private String id;

    // Unique per user — see DatabaseInitializer.
    private String userId;

    private byte[] data;

    private String contentType;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
