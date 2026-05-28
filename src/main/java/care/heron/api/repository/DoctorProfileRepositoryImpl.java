package care.heron.api.repository;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.regex.Pattern;

// Spring Data wires this fragment into DoctorProfileRepository by the `...Impl`
// naming convention and injects MongoTemplate via the generated constructor.
@RequiredArgsConstructor
public class DoctorProfileRepositoryImpl implements DoctorProfileRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<DoctorProfile> searchPublished(
            Specialization specialization, List<String> tokens, Pageable pageable) {
        // published AND [specialization] AND (token1 in name|bio OR token2 in name|bio …).
        // The published guard stays at the top level so an unpublished doctor can
        // never leak in through the name/bio OR branch.
        Criteria criteria = Criteria.where("published").is(true);
        if (specialization != null) {
            criteria = criteria.and("specialization").is(specialization);
        }
        Criteria[] anyToken = tokens.stream()
                .map(DoctorProfileRepositoryImpl::matchesNameOrBio)
                .toArray(Criteria[]::new);
        criteria = criteria.orOperator(anyToken);

        // Count without the page window, then fetch the window — a Mongo equivalent
        // of how the derived Page<> methods report totalElements/totalPages.
        long total = mongoTemplate.count(Query.query(criteria), DoctorProfile.class);
        List<DoctorProfile> content =
                mongoTemplate.find(Query.query(criteria).with(pageable), DoctorProfile.class);
        return new PageImpl<>(content, pageable, total);
    }

    // A single token matches when it appears (case-insensitive) in name OR bio.
    // Pattern.quote escapes regex metacharacters so a literal term like "c++" or a
    // stray "(" can't blow up or alter the match.
    private static Criteria matchesNameOrBio(String token) {
        Pattern needle = Pattern.compile(Pattern.quote(token), Pattern.CASE_INSENSITIVE);
        return new Criteria().orOperator(
                Criteria.where("name").regex(needle),
                Criteria.where("bio").regex(needle));
    }
}
