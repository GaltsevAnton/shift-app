package com.shiftapp.audit;

import com.shiftapp.restaurants.Restaurant;
import com.shiftapp.users.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuditLogService {

    private final AuditLogRepository repo;

    @PersistenceContext
    private EntityManager em;

    public AuditLogService(AuditLogRepository repo) {
        this.repo = repo;
    }

    // 呼び出し元と同じトランザクションに参加する（別トランザクションにはしない —
    // 同一DBのため、本体の保存が失敗すればログも一緒にロールバックされるのが正しい）
    public void log(Long restaurantId, Long actorUserId, String actorName,
                     AuditAction action, AuditEntityType entityType, Long entityId,
                     Long targetUserId, String targetUserName,
                     String summary, String detailsJson) {
        AuditLog log = new AuditLog();
        log.setRestaurant(em.getReference(Restaurant.class, restaurantId));
        if (actorUserId != null) {
            log.setActorUser(em.getReference(User.class, actorUserId));
        }
        log.setActorName(actorName);
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        if (targetUserId != null) {
            log.setTargetUser(em.getReference(User.class, targetUserId));
        }
        log.setTargetUserName(targetUserName);
        log.setSummary(summary);
        log.setDetails(detailsJson);
        log.setCreatedAt(Instant.now());
        repo.save(log);
    }
}