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

    // Public discovery is gated on `published` so incomplete / test profiles
    // never surface. The OR variant repeats PublishedTrue in BOTH branches on
    // purpose — that groups as (published AND name) OR (published AND bio), i.e.
    // published AND (name OR bio); a single PublishedTrue would leak unpublished
    // doctors through the bio branch.
    Page<DoctorProfile> findByPublishedTrue(Pageable pageable);

    Page<DoctorProfile> findByPublishedTrueAndSpecialization(
            Specialization specialization, Pageable pageable);

    Page<DoctorProfile> findByPublishedTrueAndSpecializationIn(
            Collection<Specialization> specializations, Pageable pageable);

    Page<DoctorProfile> findByPublishedTrueAndSpecializationAndNameContainingIgnoreCase(
            Specialization specialization, String name, Pageable pageable);

    Page<DoctorProfile> findByPublishedTrueAndNameContainingIgnoreCaseOrPublishedTrueAndBioContainingIgnoreCase(
            String name, String bio, Pageable pageable);
}
