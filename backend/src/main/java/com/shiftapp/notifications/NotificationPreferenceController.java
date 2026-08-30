package com.shiftapp.notifications;

import com.shiftapp.auth.security.CustomUserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/manager/notifications/preferences")
public class NotificationPreferenceController {

    private final NotificationPreferenceRepository repository;
    private final com.shiftapp.users.UserRepository userRepository;

    public NotificationPreferenceController(NotificationPreferenceRepository repository,
                                             com.shiftapp.users.UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public Map<String, Boolean> get(@AuthenticationPrincipal CustomUserDetails user) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (NotificationType type : NotificationType.values()) {
            boolean enabled = repository.findByUser_IdAndNotificationType(user.getUserId(), type)
                    .map(NotificationPreference::isEnabled)
                    .orElse(true);
            result.put(type.name(), enabled);
        }
        return result;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public Map<String, Boolean> set(@AuthenticationPrincipal CustomUserDetails userDetails,
                                     @RequestBody Map<String, Boolean> body) {
        var user = userRepository.findById(userDetails.getUserId()).orElseThrow();
        for (Map.Entry<String, Boolean> entry : body.entrySet()) {
            NotificationType type = NotificationType.valueOf(entry.getKey());
            NotificationPreference pref = repository
                    .findByUser_IdAndNotificationType(user.getId(), type)
                    .orElseGet(() -> {
                        NotificationPreference p = new NotificationPreference();
                        p.setUser(user);
                        p.setNotificationType(type);
                        return p;
                    });
            pref.setEnabled(entry.getValue());
            repository.save(pref);
        }
        return get(userDetails);
    }
}