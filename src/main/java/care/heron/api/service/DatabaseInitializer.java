package care.heron.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

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
        log.info("[db] indexes verified");
    }

    private void ensureIndex(String collection, Index index) {
        mongoTemplate.indexOps(collection).ensureIndex(index);
    }
}
