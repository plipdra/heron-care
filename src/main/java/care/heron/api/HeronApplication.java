package care.heron.api;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableMongoAuditing
@EnableScheduling
public class HeronApplication {

    // Heron is a Philippine telehealth service. Doctors author their consultation
    // hours and patients enter birthdays as plain LocalTime/LocalDate, which Spring
    // Data Mongo stores relative to the JVM's default timezone. Pinning the default
    // to Asia/Manila makes that storage host-independent, so a UTC container (e.g.
    // Render) reads the same values that a PH-time machine wrote — otherwise 9 AM
    // hours read back as 1 AM and birthdays shift a day. Instants (bookings) are
    // already UTC and unaffected. Set before the context starts so the Mongo
    // converters pick it up.
    static {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Manila"));
    }

    @PostConstruct
    void pinTimeZone() {
        // Belt-and-suspenders: re-assert after startup in case anything reset it.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Manila"));
    }

    public static void main(String[] args) {
        SpringApplication.run(HeronApplication.class, args);
    }
}
