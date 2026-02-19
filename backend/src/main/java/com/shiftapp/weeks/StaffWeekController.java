package com.shiftapp.weeks;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.weeks.dto.StaffWeekResponse;
import com.shiftapp.weeks.dto.StaffWeekSaveRequest;
import com.shiftapp.weeks.dto.WeekRowResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/staff")
public class StaffWeekController {

    private final WeekService weekService;

    public StaffWeekController(WeekService weekService) {
        this.weekService = weekService;
    }

    @GetMapping("/weeks")
    public List<WeekRowResponse> weeks(@RequestParam String month) {
        var me = CurrentUser.requireEmployee();
        YearMonth ym = YearMonth.parse(month); // "2026-02"
        return weekService.staffWeeks(me.getRestaurantId(), ym);
    }

    @GetMapping("/week")
    public StaffWeekResponse week(@RequestParam LocalDate weekStart) {
        var me = CurrentUser.requireEmployee();
        return weekService.staffWeek(me.getRestaurantId(), me.getEmployeeId(), weekStart);
    }

    @PostMapping("/week/save")
    public String save(@RequestBody @Valid StaffWeekSaveRequest req) {
        var me = CurrentUser.requireEmployee();
        return weekService.staffSaveWeek(me.getRestaurantId(), me.getEmployeeId(), req);
    }

    @PostMapping("/week/copy-prev")
    public String copyPrev(@RequestParam LocalDate weekStart) {
        var me = CurrentUser.requireEmployee();
        return weekService.staffCopyPrevWeek(me.getRestaurantId(), me.getEmployeeId(), weekStart);
    }
}
