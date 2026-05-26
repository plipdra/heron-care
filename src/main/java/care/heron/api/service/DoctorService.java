package care.heron.api.service;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.DoctorProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DoctorService {

    private final DoctorProfileRepository doctorProfileRepository;

    // Public discovery — dispatches to the right repository method based on which
    // filters are set. Patch-update on profile fields means doctors don't lose
    // unrelated fields on partial submits.
    public Page<DoctorProfile> listPublic(
            Specialization specialization, String search, Pageable pageable) {
        boolean hasSearch = search != null && !search.isBlank();
        if (specialization != null && hasSearch) {
            return doctorProfileRepository.findBySpecializationAndNameContainingIgnoreCase(
                    specialization, search.trim(), pageable);
        }
        if (specialization != null) {
            return doctorProfileRepository.findBySpecialization(specialization, pageable);
        }
        if (hasSearch) {
            String term = search.trim();
            return doctorProfileRepository.findByNameContainingIgnoreCaseOrBioContainingIgnoreCase(
                    term, term, pageable);
        }
        return doctorProfileRepository.findAll(pageable);
    }

    public DoctorProfile getPublic(String id) {
        return doctorProfileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", id));
    }

    public DoctorProfile getMine(String userId) {
        return doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Doctor profile for user " + userId + " not found"));
    }

    public DoctorProfile updateMine(String userId, UpdateDoctorProfileCommand command) {
        DoctorProfile profile = getMine(userId);
        if (command.name() != null) profile.setName(command.name());
        if (command.bio() != null) profile.setBio(command.bio());
        if (command.specialization() != null) profile.setSpecialization(command.specialization());
        if (command.defaultMeetingLink() != null) profile.setDefaultMeetingLink(command.defaultMeetingLink());
        if (command.yearsOfExperience() != null) profile.setYearsOfExperience(command.yearsOfExperience());
        return doctorProfileRepository.save(profile);
    }

    public record UpdateDoctorProfileCommand(
            String name,
            String bio,
            Specialization specialization,
            String defaultMeetingLink,
            Integer yearsOfExperience) {}
}
