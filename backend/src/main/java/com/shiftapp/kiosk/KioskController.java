package com.shiftapp.kiosk;

import com.shiftapp.kiosk.dto.PunchRequest;
import com.shiftapp.kiosk.dto.PunchResponse;
import com.shiftapp.kiosk.dto.StaffStatusResponse;
import com.shiftapp.users.dto.UserResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kiosk")
public class KioskController {

    private final KioskService kioskService;

    public KioskController(KioskService kioskService) {
        this.kioskService = kioskService;
    }

    // Список всех активных сотрудников ресторана (без JWT — для киоска)
    // restaurantId передаётся как параметр — планшет настроен на конкретный ресторан
    // Сортировка: по минимальному sortOrder среди отделов сотрудника (см. KioskService)
    @GetMapping("/staff")
    public List<UserResponse> getStaffList(@RequestParam Long restaurantId) {
        return kioskService.getStaffList(restaurantId);
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