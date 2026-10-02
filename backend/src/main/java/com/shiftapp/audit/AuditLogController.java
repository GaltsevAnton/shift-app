package com.shiftapp.audit;

import com.shiftapp.audit.dto.AuditLogResponse;
import com.shiftapp.common.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/manager/audit-log")
public class AuditLogController {

    private static final ZoneId ZONE = ZoneId.of("Asia/Tokyo");

    private final AuditLogRepository repo;

    public AuditLogController(AuditLogRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('LOGGING_VIEW')")
    public List<AuditLogResponse> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long targetUserId,
            @RequestParam(required = false) AuditEntityType entityType
    ) {
        Long restaurantId = CurrentUser.require().getRestaurantId();

        Instant fromInstant = from != null ? from.atStartOfDay(ZONE).toInstant() : null;
        // to は指定日の終わり（翌日0時）まで含める
        Instant toInstant   = to != null ? to.plusDays(1).atStartOfDay(ZONE).toInstant() : null;

        return repo.search(restaurantId, fromInstant, toInstant, targetUserId, entityType)
                .stream()
                .map(AuditLogResponse::from)
                .toList();
    }
}