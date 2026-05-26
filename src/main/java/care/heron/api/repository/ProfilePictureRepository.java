package care.heron.api.repository;

import care.heron.api.document.ProfilePicture;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ProfilePictureRepository extends MongoRepository<ProfilePicture, String> {

    Optional<ProfilePicture> findByUserId(String userId);

    boolean existsByUserId(String userId);

    void deleteByUserId(String userId);
}
