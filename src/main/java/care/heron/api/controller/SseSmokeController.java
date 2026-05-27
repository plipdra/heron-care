package care.heron.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

// TEMPORARY diagnostic — proves an SSE stream survives the production edge
// (Cloudflare/Render can buffer a streamed response so events that flow fine on
// localhost arrive only at stream close in prod). Pushes a tick every second for
// ~15s plus an opening heartbeat comment, then completes. Public and unscoped by
// design — this is a pure transport test, not the real notification feature.
// DELETE once the deployed path is verified; must not ship in submission.
@RestController
public class SseSmokeController {

    @GetMapping("/sse-smoke")
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(30_000L);
        ScheduledExecutorService exec = Executors.newSingleThreadScheduledExecutor();
        AtomicInteger count = new AtomicInteger();

        // A comment line flushed immediately — if the edge buffers, even this
        // won't arrive until the connection closes, which is the tell we're testing for.
        try {
            emitter.send(SseEmitter.event().comment("smoke stream open"));
        } catch (IOException e) {
            emitter.completeWithError(e);
            exec.shutdown();
            return emitter;
        }

        exec.scheduleAtFixedRate(() -> {
            try {
                int n = count.incrementAndGet();
                emitter.send(SseEmitter.event().name("tick").data("tick " + n));
                if (n >= 15) {
                    emitter.complete();
                    exec.shutdown();
                }
            } catch (IOException e) {
                emitter.completeWithError(e);
                exec.shutdown();
            }
        }, 1, 1, TimeUnit.SECONDS);

        emitter.onCompletion(exec::shutdown);
        emitter.onTimeout(() -> {
            emitter.complete();
            exec.shutdown();
        });
        return emitter;
    }
}
