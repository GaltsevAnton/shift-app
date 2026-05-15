package com.shiftapp.settings.workplace;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkplaceRepository extends JpaRepository<Workplace, Long> {
    List<Workplace> findAllByRestaurant_IdOrderByIdAsc(Long restaurantId);
    boolean existsByRestaurant_IdAndNameIgnoreCase(Long restaurantId, String name);
}