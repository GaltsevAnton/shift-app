package com.shiftapp.settings.department;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findAllByRestaurant_IdOrderByIdAsc(Long restaurantId);
    boolean existsByRestaurant_IdAndNameIgnoreCase(Long restaurantId, String name);
}