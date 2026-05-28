package care.heron.api.repository;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DoctorProfileRepository extends MongoRepository<DoctorProfile, String> {

    Optional<DoctorProfile> findByUserId(String userId);

    // Batch resolve for read-time enrichment (e.g. a patient's booking list) —
    // one query for the page's distinct doctors, not N lookups.
    List<DoctorProfile> findByUserIdIn(Collection<String> userIds);

    Page<DoctorProfile> findBySpecialization(Specialization specialization, Pageable pageable);

    Page<DoctorProfile> findBySpecializationIn(
            Collection<Specialization> specializations, Pageable pageable);

    Page<DoctorProfile> findByNameContainingIgnoreCaseOrBioContainingIgnoreCase(
            String name, String bio, Pageable pageable);

    Page<DoctorProfile> findBySpecializationAndNameContainingIgnoreCase(
            Specialization specialization, String name, Pageable pageable);
}
