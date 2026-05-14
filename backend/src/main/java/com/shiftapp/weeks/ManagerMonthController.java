package com.shiftapp.weeks;
 
import com.shiftapp.common.CurrentUser;
import com.shiftapp.weeks.dto.ManagerWeekResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
 
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
 
@RestController
@RequestMapping("/api/manager")
@RequiredArgsConstructor
public class ManagerMonthController {
 
    private final WeekService weekService;
 
    /**
     * GET /api/manager/month?month=YYYY-MM
     * Returns all weeks that overlap with the given month,
     * each with its status and all staff preferences.
     */
    @GetMapping("/month")
    public List<ManagerWeekResponse> getMonth(
            @RequestParam String month  // "YYYY-MM"
    ) {
        var currentUser = CurrentUser.require();
        Long restaurantId = currentUser.getRestaurantId();
 
        YearMonth ym = YearMonth.parse(month);
        LocalDate firstDay = ym.atDay(1);
        LocalDate lastDay  = ym.atEndOfMonth();
 
        // Find Monday of the first week overlapping this month
        LocalDate cursor = firstDay.with(
                java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)
        );
 
        List<ManagerWeekResponse> result = new ArrayList<>();
 
        // Iterate week by week until cursor is past the last day of month
        while (!cursor.isAfter(lastDay)) {
            ManagerWeekResponse weekData = weekService.managerWeek(restaurantId, cursor);
            result.add(weekData);
            cursor = cursor.plusWeeks(1);
        }
 
        return result;
    }
}