package care.heron.api.dto.common;

import org.springframework.data.domain.Page;

import java.util.List;

// Wrapper so the wire shape is stable even if we change paging machinery.
// Spring's Page serialises with PageImpl-specific internals — this hides them.
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
