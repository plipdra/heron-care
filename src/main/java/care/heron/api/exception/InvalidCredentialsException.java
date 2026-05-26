package care.heron.api.exception;

public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Email or password is incorrect.");
    }
}
