package com.shiftapp.months;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MonthStatusRepository extends JpaRepository<MonthStatus, Long> {
    Optional<MonthStatus> findByRestaurant_IdAndYearMonthAndHalf(Long restaurantId, String yearMonth, int half);
}