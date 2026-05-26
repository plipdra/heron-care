package care.heron.api.service;

import care.heron.api.document.ProfilePicture;
import care.heron.api.repository.ProfilePictureRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProfilePictureService {

    private final ProfilePictureRepository repository;
    private final ProfilePictureValidator validator;

    public ProfilePicture upload(String userId, String dataUrl) {
        ProfilePictureValidator.ValidatedPicture validated = validator.parse(dataUrl);
        ProfilePicture picture = repository.findByUserId(userId)
                .orElseGet(() -> ProfilePicture.builder().userId(userId).build());
        picture.setData(validated.bytes());
        picture.setContentType(validated.contentType());
        return repository.save(picture);
    }

    public Optional<ProfilePicture> get(String userId) {
        return repository.findByUserId(userId);
    }

    public void delete(String userId) {
        repository.findByUserId(userId).ifPresent(repository::delete);
    }
}
