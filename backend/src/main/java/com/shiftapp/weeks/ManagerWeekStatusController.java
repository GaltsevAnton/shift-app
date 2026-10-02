package com.shiftapp.weeks;

import com.shiftapp.common.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/manager/week-status")
public class ManagerWeekStatusController {

    private final WeekService weekService;

    public ManagerWeekStatusController(WeekService weekService) {
        this.weekService = weekService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SHIFT_VIEW')")
    public String setStatus(@RequestParam LocalDate weekStart,
                            @RequestParam WeekStatusType status) {
        var me = CurrentUser.require();
        return weekService.managerSetWeekStatus(me.getRestaurantId(), me.getUserId(), weekStart, status);
    }
}
