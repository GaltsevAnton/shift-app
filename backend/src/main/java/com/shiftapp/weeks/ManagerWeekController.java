package com.shiftapp.weeks;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.weeks.dto.ManagerWeekResponse;
import com.shiftapp.weeks.dto.ManagerWeekSaveRequest;
import com.shiftapp.weeks.dto.WeekRowResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/manager")
public class ManagerWeekController {

    private final WeekService weekService;

    public ManagerWeekController(WeekService weekService) {
        this.weekService = weekService;
    }

    @GetMapping("/weeks")
    public List<WeekRowResponse> weeks(@RequestParam String month) {
        var me = CurrentUser.require();
        YearMonth ym = YearMonth.parse(month); // "2026-02"
        return weekService.managerWeeks(me.getRestaurantId(), ym);
    }

    @GetMapping("/week")
    public ManagerWeekResponse week(@RequestParam LocalDate weekStart) {
        var me = CurrentUser.require();
        return weekService.managerWeek(me.getRestaurantId(), weekStart);
    }

    @PostMapping("/week/save")
    public String save(@RequestBody @Valid ManagerWeekSaveRequest req) {
        var me = CurrentUser.require();
        return weekService.managerSaveStaffWeek(me.getRestaurantId(), me.getUserId(), req);
    }
}
