package com.shiftapp.months;

import com.shiftapp.audit.AuditAction;
import com.shiftapp.audit.AuditEntityType;
import com.shiftapp.audit.AuditLogService;
import com.shiftapp.common.CurrentUser;
import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/manager/month-status")
public class MonthStatusController {

    private final MonthStatusRepository repo;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @PersistenceContext
    private EntityManager em;

    public MonthStatusController(MonthStatusRepository repo, UserRepository userRepository, AuditLogService auditLogService) {
        this.repo = repo;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SHIFT_VIEW')")
    public Map<String, Object> getStatus(@RequestParam String month) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        String status1 = repo.findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, 1)
                .map(MonthStatus::getStatus).orElse("RECEIVING");
        String status2 = repo.findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, 2)
                .map(MonthStatus::getStatus).orElse("RECEIVING");
        return Map.of("status1", status1, "status2", status2);
    }
    
    @PostMapping
    @PreAuthorize("hasAuthority('SHIFT_VIEW')")
    public Map<String, String> setStatus(
            @RequestParam String month,
            @RequestParam String status,
            @RequestParam(defaultValue = "1") int half) {
        Long restaurantId = CurrentUser.require().getRestaurantId();
        Long userId = CurrentUser.require().getUserId();
    
        MonthStatus ms = repo.findByRestaurant_IdAndYearMonthAndHalf(restaurantId, month, half)
                .orElseGet(MonthStatus::new);

        boolean existed = ms.getId() != null;
        String oldStatus = existed ? ms.getStatus() : null;
    
        ms.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        ms.setYearMonth(month);
        ms.setHalf(half);
        ms.setStatus(status);
        var actor = userRepository.findById(userId).orElseThrow();
        ms.setUpdatedBy(actor);
        ms.setUpdatedAt(Instant.now());
    
        repo.save(ms);

        if (!Objects.equals(oldStatus, status)) {
            String halfLabel = half == 1 ? "1〜15日" : "16〜末日";
            auditLogService.log(
                restaurantId, userId, actor.getFullName(),
                AuditAction.UPDATE, AuditEntityType.MONTH_STATUS, ms.getId(),
                null, null,
                month + "（" + halfLabel + "）のステータス: " + statusLabel(oldStatus) + " → " + statusLabel(status),
                null
            );
        }

        return Map.of("status", status);
    }

    private String statusLabel(String s) {
        if (s == null) return "未設定";
        return switch (s) {
            case "RECEIVING" -> "受付中";
            case "DRAFTING"  -> "作成中";
            case "CONFIRMED" -> "確定";
            default -> s;
        };
    }
}