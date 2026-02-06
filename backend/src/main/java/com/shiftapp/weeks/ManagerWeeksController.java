package com.shiftapp.weeks;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.weeks.dto.WeekRowResponse;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/manager")
public class ManagerWeeksController {

    private final WeekService weekService;

    public ManagerWeeksController(WeekService weekService) {
        this.weekService = weekService;
    }

    // список недель в месяце (как у staff)
    @GetMapping("/weeks")
    public List<WeekRowResponse> weeks(@RequestParam String month) {
        var me = CurrentUser.require();
        YearMonth ym = YearMonth.parse(month); // "2026-02"
        return weekService.staffWeeks(me.getRestaurantId(), ym);
    }
}
