package care.heron.api.exception;

// Thrown when the same Idempotency-Key is replayed with a different
// request body. Mapped to 422 Unprocessable Entity. The semantics: the
// key was previously claimed by a different request, so the server can
// neither replay (different body) nor create (key already used). The
// client should generate a new key for a new request.
public class IdempotencyKeyReusedException extends RuntimeException {

    public IdempotencyKeyReusedException() {
        super("Idempotency-Key was used previously with a different request body.");
    }
}
