package com.shiftapp.notifications;

import com.shiftapp.auth.security.CustomUserDetails;
import com.shiftapp.restaurants.RestaurantRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalTime;
import java.util.Map;

@RestController
@RequestMapping("/api/manager/notifications/settings")
public class NotificationSettingsController {

    private final NotificationSettingsRepository repository;
    private final RestaurantRepository restaurantRepository;

    public NotificationSettingsController(NotificationSettingsRepository repository,
                                           RestaurantRepository restaurantRepository) {
        this.repository = repository;
        this.restaurantRepository = restaurantRepository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public Map<String, String> get(@AuthenticationPrincipal CustomUserDetails user) {
        LocalTime t = repository.findByRestaurant_Id(user.getRestaurantId())
                .map(NotificationSettings::getForgotClockoutCheckTime)
                .orElse(LocalTime.MIDNIGHT);
        return Map.of("forgotClockoutCheckTime", t.toString());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public Map<String, String> set(@AuthenticationPrincipal CustomUserDetails user,
                                    @RequestParam String time) {
        NotificationSettings settings = repository.findByRestaurant_Id(user.getRestaurantId())
                .orElseGet(() -> {
                    NotificationSettings s = new NotificationSettings();
                    s.setRestaurant(restaurantRepository.getReferenceById(user.getRestaurantId()));
                    return s;
                });
        settings.setForgotClockoutCheckTime(LocalTime.parse(time));
        repository.save(settings);
        return get(user);
    }
}