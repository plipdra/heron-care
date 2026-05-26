package care.heron.api.service;

import care.heron.api.exception.InvalidProfilePictureException;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Server-side validation for uploaded profile pictures. Client-side resize
// is convenience, never security — clients can be bypassed with curl. Two
// checks here: byte length cap (~1MB) and magic-byte format check
// (JPEG/PNG only; SVG explicitly rejected as an XSS vector when rendered
// via <img>).
//
// Decompression-bomb defense via decoded-dimension check is intentionally
// out of scope for MVP — the 1MB byte cap + magic-byte filter means
// worst-case decoded size is ~24MB RAM, not a real attack surface at this
// scale. A streaming decoder with abort-on-dimension is the right next
// iteration if the threat model changes.
@Service
public class ProfilePictureValidator {

    private static final int MAX_BYTES = 1_000_000;

    private static final Pattern DATA_URL_PATTERN =
            Pattern.compile("^data:(image/(?:jpeg|jpg|png));base64,(.+)$");

    public ValidatedPicture parse(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            throw new InvalidProfilePictureException("Picture data is required.");
        }
        Matcher matcher = DATA_URL_PATTERN.matcher(dataUrl);
        if (!matcher.matches()) {
            throw new InvalidProfilePictureException(
                    "Picture must be a JPEG or PNG data URL.");
        }
        String declaredContentType = normaliseContentType(matcher.group(1));
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException ex) {
            throw new InvalidProfilePictureException("Picture base64 payload is malformed.");
        }
        if (bytes.length == 0) {
            throw new InvalidProfilePictureException("Picture payload is empty.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new InvalidProfilePictureException(
                    "Picture exceeds the 1MB size limit. Resize before uploading.");
        }
        String actualContentType = sniffContentType(bytes);
        if (actualContentType == null) {
            throw new InvalidProfilePictureException(
                    "Picture is not a recognised JPEG or PNG.");
        }
        if (!actualContentType.equals(declaredContentType)) {
            throw new InvalidProfilePictureException(
                    "Declared content type does not match the file bytes.");
        }
        return new ValidatedPicture(bytes, actualContentType);
    }

    private String normaliseContentType(String fromDataUrl) {
        return fromDataUrl.equals("image/jpg") ? "image/jpeg" : fromDataUrl;
    }

    private String sniffContentType(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "image/png";
        }
        return null;
    }

    public record ValidatedPicture(byte[] bytes, String contentType) {}
}
