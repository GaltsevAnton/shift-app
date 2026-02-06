package com.shiftapp.shifts;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
    Optional<Shift> findByUser_IdAndWorkDate(Long userId, LocalDate workDate);
    Optional<Shift> findByIdAndRestaurant_Id(Long id, Long restaurantId);
    List<Shift> findByRestaurant_IdAndWorkDateBetween(Long restaurantId, LocalDate from, LocalDate to);

    @Modifying
    @Query("delete from Shift s where s.restaurant.id = :rid and s.workDate between :from and :to")
    int deleteByRestaurantAndDateRange(@Param("rid") Long restaurantId,
                                    @Param("from") LocalDate from,
                                    @Param("to") LocalDate to);
}
