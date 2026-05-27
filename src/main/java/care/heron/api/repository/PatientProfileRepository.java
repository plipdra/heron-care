package care.heron.api.repository;

import care.heron.api.document.PatientProfile;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PatientProfileRepository extends MongoRepository<PatientProfile, String> {

    Optional<PatientProfile> findByUserId(String userId);

    // Batch resolve patient display names for the doctor's appointment list —
    // one query for the page's distinct patients, not N lookups.
    List<PatientProfile> findByUserIdIn(Collection<String> userIds);
}
