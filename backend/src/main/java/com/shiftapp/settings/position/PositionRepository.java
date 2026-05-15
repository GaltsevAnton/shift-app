package com.shiftapp.settings.position;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PositionRepository extends JpaRepository<Position, Long> {
    List<Position> findAllByRestaurant_IdOrderByIdAsc(Long restaurantId);
    boolean existsByRestaurant_IdAndNameIgnoreCase(Long restaurantId, String name);
}