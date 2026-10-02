package com.shiftapp.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("""
        SELECT a FROM AuditLog a
        WHERE a.restaurant.id = :restaurantId
          AND (CAST(:from AS java.time.Instant) IS NULL OR a.createdAt >= :from)
          AND (CAST(:to AS java.time.Instant) IS NULL OR a.createdAt < :to)
          AND (CAST(:targetUserId AS java.lang.Long) IS NULL OR a.targetUser.id = :targetUserId)
          AND (CAST(:entityType AS java.lang.String) IS NULL OR a.entityType = :entityType)
        ORDER BY a.createdAt DESC
    """)
    List<AuditLog> search(
        @Param("restaurantId") Long restaurantId,
        @Param("from") Instant from,
        @Param("to") Instant to,
        @Param("targetUserId") Long targetUserId,
        @Param("entityType") AuditEntityType entityType
    );
}