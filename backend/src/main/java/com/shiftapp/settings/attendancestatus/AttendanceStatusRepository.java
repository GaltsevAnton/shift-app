package com.shiftapp.settings.attendancestatus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceStatusRepository extends JpaRepository<AttendanceStatus, Long> {
    List<AttendanceStatus> findAllByRestaurant_IdOrderByIdAsc(Long restaurantId);
    Optional<AttendanceStatus> findByIdAndRestaurant_Id(Long id, Long restaurantId);
    boolean existsByRestaurant_IdAndNameIgnoreCase(Long restaurantId, String name);
    boolean existsByRestaurant_IdAndNameIgnoreCaseAndIdNot(Long restaurantId, String name, Long id);
}