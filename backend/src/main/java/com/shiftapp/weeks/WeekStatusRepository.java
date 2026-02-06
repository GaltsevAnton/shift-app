package com.shiftapp.weeks;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WeekStatusRepository extends JpaRepository<WeekStatus, Long> {
    Optional<WeekStatus> findByRestaurant_IdAndWeekStart(Long restaurantId, LocalDate weekStart);
    List<WeekStatus> findByRestaurant_IdAndWeekStartBetween(Long restaurantId, LocalDate from, LocalDate to);
}
