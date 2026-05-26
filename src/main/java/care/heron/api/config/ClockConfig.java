package care.heron.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

// Injectable clock so services can be tested against a fixed instant.
// Production wiring is system UTC; tests substitute Clock.fixed(...).
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
