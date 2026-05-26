package care.heron.api.dto.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Client sends the picture as a data URL (already resized + base64-encoded
// client-side). ProfilePictureValidator decodes + verifies before storage.
// Size cap here is a coarse first-line defence; the byte-level cap lives
// in the validator.
public record UploadProfilePictureRequest(
        @NotBlank(message = "Picture data is required.")
        @Size(max = 1_400_000, message = "Picture payload exceeds the upload limit.")
        String dataUrl
) {}
