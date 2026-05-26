package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.DoctorProfile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

// Ensures required indexes exist on startup. The local docker-compose mongo
// container also runs db/init/*.js which creates collections with $jsonSchema
// validators — Atlas does not run those scripts, so this runner is the
// canonical index-creation path for production.
//
// @Order(1) so this runs before SeedRunner (which is @Order(2)). Indexes
// matter for the unique-email constraint that SeedRunner's idempotency relies on.
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class DatabaseInitializer implements CommandLineRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(String... args) {
        ensureIndex("users", new Index().on("email", Direction.ASC).unique().named("users_email_unique"));
        ensureIndex("doctor_profiles",
                new Index().on("userId", Direction.ASC).unique().named("doctor_profiles_userId_unique"));
        ensureIndex("doctor_profiles",
                new Index().on("specialization", Direction.ASC).named("doctor_profiles_specialization"));
        ensureIndex("patient_profiles",
                new Index().on("userId", Direction.ASC).unique().named("patient_profiles_userId_unique"));
        ensureIndex("profile_pictures",
                new Index().on("userId", Direction.ASC).unique().named("profile_pictures_userId_unique"));
        log.info("[db] indexes verified");

        // One-shot cleanup of legacy profilePicturePath field. Was on PatientProfile
        // and DoctorProfile before the picture move to a dedicated collection.
        // Idempotent: $unset is a no-op when the field is absent.
        long doctorsCleaned = mongoTemplate.updateMulti(
                new Query(), new Update().unset("profilePicturePath"), "doctor_profiles")
                .getModifiedCount();
        long patientsCleaned = mongoTemplate.updateMulti(
                new Query(), new Update().unset("profilePicturePath"), "patient_profiles")
                .getModifiedCount();
        if (doctorsCleaned > 0 || patientsCleaned > 0) {
            log.info("[db] unset legacy profilePicturePath on {} doctor + {} patient docs",
                    doctorsCleaned, patientsCleaned);
        }

        // Backfill default availability on doctors that pre-date the schedule
        // schema. Idempotent — only applies to docs missing the field.
        List<DoctorProfile> needingAvailability = mongoTemplate.find(
                new Query(Criteria.where("availability").exists(false)),
                DoctorProfile.class);
        if (!needingAvailability.isEmpty()) {
            for (DoctorProfile profile : needingAvailability) {
                profile.setAvailability(Availability.defaultBusinessHours());
                mongoTemplate.save(profile);
            }
            log.info("[db] backfilled default availability on {} doctor profiles",
                    needingAvailability.size());
        }
    }

    private void ensureIndex(String collection, Index index) {
        mongoTemplate.indexOps(collection).ensureIndex(index);
    }
}
