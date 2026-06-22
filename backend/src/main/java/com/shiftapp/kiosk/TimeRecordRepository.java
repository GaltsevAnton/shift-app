package com.shiftapp.kiosk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

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

    List<TimeRecord> findByUser_IdOrderByRecordedAtAsc(Long userId);
    
    void deleteByUserId(Long userId);
}