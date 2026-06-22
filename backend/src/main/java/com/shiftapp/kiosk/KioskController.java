package com.shiftapp.kiosk;

import com.shiftapp.kiosk.dto.PunchRequest;
import com.shiftapp.kiosk.dto.PunchResponse;
import com.shiftapp.kiosk.dto.StaffStatusResponse;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;
import com.shiftapp.users.dto.UserResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kiosk")
public class KioskController {

    private final KioskService    kioskService;
    private final UserRepository  userRepository;

    public KioskController(KioskService kioskService,
                           UserRepository userRepository) {
        this.kioskService   = kioskService;
        this.userRepository = userRepository;
    }

    // Список всех активных сотрудников ресторана (без JWT — для киоска)
    // restaurantId передаётся как параметр — планшет настроен на конкретный ресторан
    @GetMapping("/staff")
    public List<UserResponse> getStaffList(@RequestParam Long restaurantId) {
        return userRepository
            .findAllByRestaurant_IdOrderByIdDesc(restaurantId)
            .stream()
            .filter(u -> u.isActive() && (u.getRole() == UserRole.STAFF || u.getRole() == UserRole.MANAGER))
            .map(UserResponse::from)
            .toList();
    }

    // Текущий статус сотрудника за сегодня
    @GetMapping("/status/{userId}")
    public StaffStatusResponse getStatus(@PathVariable Long userId) {
        return kioskService.getStatus(userId);
    }

    // Фиксация прихода/ухода/перерыва
    @PostMapping("/punch")
    public PunchResponse punch(@RequestBody PunchRequest req) {
        return kioskService.punch(req);
    }
}