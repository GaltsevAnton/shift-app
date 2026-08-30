package com.shiftapp.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    List<NotificationPreference> findByUser_Id(Long userId);

    Optional<NotificationPreference> findByUser_IdAndNotificationType(Long userId, NotificationType type);

    // Все менеджеры ресторана, у кого явно ВКЛЮЧЕН тип (используется вместе с opt-out логикой в сервисе)
    List<NotificationPreference> findByUser_Restaurant_IdAndNotificationTypeAndEnabled(
            Long restaurantId, NotificationType type, boolean enabled);
}