package com.shiftapp.shifts;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.shifts.dto.BulkShiftRequest;
import com.shiftapp.shifts.dto.ShiftResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import com.shiftapp.shifts.dto.CopyWeekRequest;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/manager/shifts")
public class ManagerShiftController {

    private final ShiftService shiftService;

    public ManagerShiftController(ShiftService shiftService) {
        this.shiftService = shiftService;
    }

    @PostMapping("/bulk")
    public String bulk(@RequestBody @Valid BulkShiftRequest req) {
        var me = CurrentUser.require();
        shiftService.bulkUpsert(me.getUserId(), me.getRestaurantId(), req);
        return "OK";
    }

    @GetMapping
    public List<ShiftResponse> list(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        var me = CurrentUser.require();
        return shiftService.list(me.getRestaurantId(), from, to);
    }

    @PostMapping("/copy-week")
    public String copyWeek(@RequestBody @Valid CopyWeekRequest req) {
        var me = CurrentUser.require();
        int count = shiftService.copyWeek(me.getUserId(), me.getRestaurantId(), req);
        return "COPIED=" + count;
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        var me = CurrentUser.require();
        shiftService.deleteShift(me.getRestaurantId(), id);
        return "DELETED";
    }

}
