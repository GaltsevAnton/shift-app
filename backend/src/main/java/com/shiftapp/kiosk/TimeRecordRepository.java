package com.shiftapp.kiosk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TimeRecordRepository extends JpaRepository<TimeRecord, Long> {

    // Все записи сотрудника за день (для статуса на киоске)
    List<TimeRecord> findByUser_IdAndWorkDateOrderByRecordedAtAsc(Long userId, LocalDate workDate);

    // Все записи ресторана за диапазон дат (для менеджера)
    @Query("""
        SELECT t FROM TimeRecord t
        JOIN FETCH t.user
        LEFT JOIN FETCH t.editedBy
        WHERE t.restaurant.id = :restaurantId
          AND t.workDate BETWEEN :from AND :to
        ORDER BY t.workDate ASC, t.recordedAt ASC
    """)
    List<TimeRecord> findByRestaurantAndDateRange(
        @Param("restaurantId") Long restaurantId,
        @Param("from") LocalDate from,
        @Param("to") LocalDate to
    );

    // Все записи конкретного сотрудника за диапазон дат
    List<TimeRecord> findByUser_IdAndWorkDateBetweenOrderByWorkDateAscRecordedAtAsc(
        Long userId, LocalDate from, LocalDate to
    );

    // ⚠️ Загружает ВСЮ историю сотрудника — для киоска больше не используется
    // (оставлен, если вызывается где-то ещё)
    List<TimeRecord> findByUser_IdOrderByRecordedAtAsc(Long userId);

    void deleteByUserId(Long userId);

    // ── Лёгкие запросы для статуса на киоске (вместо загрузки всей истории) ──

    // Время последней записи указанного типа у каждого сотрудника: строки [userId, MAX(recordedAt)]
    @Query("""
        SELECT t.user.id, MAX(t.recordedAt) FROM TimeRecord t
        WHERE t.user.id IN :userIds AND t.recordType = :type
        GROUP BY t.user.id
    """)
    List<Object[]> findLastRecordedAtByUserIds(
        @Param("userIds") Collection<Long> userIds,
        @Param("type") TimeRecordType type
    );

    // Записи сотрудника начиная с указанного момента (записи открытой смены)
    @Query("""
        SELECT new com.shiftapp.kiosk.KioskRecordRow(t.user.id, t.recordType, t.recordedAt, t.workDate, t.photoPath)
        FROM TimeRecord t
        WHERE t.user.id = :userId AND t.recordedAt >= :from
        ORDER BY t.recordedAt ASC
    """)
    List<KioskRecordRow> findRowsSince(
        @Param("userId") Long userId,
        @Param("from") Instant from
    );

    // Записи сотрудников за указанный день
    @Query("""
        SELECT new com.shiftapp.kiosk.KioskRecordRow(t.user.id, t.recordType, t.recordedAt, t.workDate, t.photoPath)
        FROM TimeRecord t
        WHERE t.user.id IN :userIds AND t.workDate = :workDate
        ORDER BY t.recordedAt ASC
    """)
    List<KioskRecordRow> findRowsByUserIdsAndWorkDate(
        @Param("userIds") Collection<Long> userIds,
        @Param("workDate") LocalDate workDate
    );

    // Последняя запись указанного типа (при отметке — workDate открытой смены)
    Optional<TimeRecord> findFirstByUser_IdAndRecordTypeOrderByRecordedAtDesc(Long userId, TimeRecordType recordType);
}