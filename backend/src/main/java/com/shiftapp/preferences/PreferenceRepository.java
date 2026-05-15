package com.shiftapp.preferences;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PreferenceRepository extends JpaRepository<Preference, Long> {

    Optional<Preference> findByUser_IdAndWorkDate(Long userId, LocalDate workDate);

    // Без слотов (для простых проверок)
    List<Preference> findByUser_IdAndWorkDateBetween(Long userId, LocalDate from, LocalDate to);

    // С подгрузкой слотов (используем JOIN FETCH чтобы избежать N+1)
    @Query("SELECT DISTINCT p FROM Preference p " +
           "LEFT JOIN FETCH p.slots " +
           "WHERE p.user.id = :userId AND p.workDate BETWEEN :from AND :to")
    List<Preference> findByUser_IdAndWorkDateBetweenWithSlots(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT DISTINCT p FROM Preference p " +
           "LEFT JOIN FETCH p.slots " +
           "WHERE p.restaurant.id = :restaurantId AND p.workDate BETWEEN :from AND :to")
    List<Preference> findByRestaurant_IdAndWorkDateBetweenWithSlots(
            @Param("restaurantId") Long restaurantId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}