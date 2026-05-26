package care.heron.api.repository;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DoctorProfileRepository extends MongoRepository<DoctorProfile, String> {

    Optional<DoctorProfile> findByUserId(String userId);

    Page<DoctorProfile> findBySpecialization(Specialization specialization, Pageable pageable);

    Page<DoctorProfile> findByNameContainingIgnoreCaseOrBioContainingIgnoreCase(
            String name, String bio, Pageable pageable);

    Page<DoctorProfile> findBySpecializationAndNameContainingIgnoreCase(
            Specialization specialization, String name, Pageable pageable);
}
