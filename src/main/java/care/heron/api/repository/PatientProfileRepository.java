package care.heron.api.repository;

import care.heron.api.document.PatientProfile;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PatientProfileRepository extends MongoRepository<PatientProfile, String> {

    Optional<PatientProfile> findByUserId(String userId);
}
