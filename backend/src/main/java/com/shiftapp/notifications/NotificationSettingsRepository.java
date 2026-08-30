package com.shiftapp.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface NotificationSettingsRepository extends JpaRepository<NotificationSettings, Long> {
    Optional<NotificationSettings> findByRestaurant_Id(Long restaurantId);
}