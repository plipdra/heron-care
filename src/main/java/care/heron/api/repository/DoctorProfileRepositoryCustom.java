package care.heron.api.repository;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

// Hand-written query that the derived-method DSL can't express: a tokenized text
// search where a doctor matches if ANY of the search words appears in their name
// or bio. The token count is variable, so this lives in a fragment backed by
// MongoTemplate rather than a method-name-derived query.
public interface DoctorProfileRepositoryCustom {

    // Published doctors whose name or bio contains any of the given tokens
    // (case-insensitive), optionally constrained to a single specialty. Tokens are
    // expected to be pre-cleaned (lowercased, blanks/stopwords dropped) by the
    // caller; an empty token list should never reach here.
    Page<DoctorProfile> searchPublished(
            Specialization specialization, List<String> tokens, Pageable pageable);
}
