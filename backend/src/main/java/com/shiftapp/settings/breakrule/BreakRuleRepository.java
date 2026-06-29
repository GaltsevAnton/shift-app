package com.shiftapp.settings.breakrule;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BreakRuleRepository extends JpaRepository<BreakRule, Long> {
    List<BreakRule> findByRestaurant_IdOrderByThresholdMinutesAsc(Long restaurantId);
}