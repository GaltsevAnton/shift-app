package com.shiftapp.weeks;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.users.UserRepository;
import com.shiftapp.weeks.dto.ManagerStaffWeekSaveRequest;
import com.shiftapp.weeks.dto.SlotDto;
import com.shiftapp.weeks.dto.StaffWeekDay;
import com.shiftapp.weeks.dto.StaffWeekResponse;

@RestController
@RequestMapping("/api/manager")
public class ManagerStaffWeekController {

    private final WeekService weekService;
    private final WeekStatusRepository weekStatusRepository;
    private final PreferenceRepository preferenceRepository;
    private final UserRepository userRepository;

    public ManagerStaffWeekController(
            WeekService weekService,
            WeekStatusRepository weekStatusRepository,
            PreferenceRepository preferenceRepository,
            UserRepository userRepository
    ) {
        this.weekService            = weekService;
        this.weekStatusRepository   = weekStatusRepository;
        this.preferenceRepository   = preferenceRepository;
        this.userRepository         = userRepository;
    }

    private static LocalDate mondayOf(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
    }

    private WeekStatusType getStatusOrDefault(Long restaurantId, LocalDate weekStart) {
        return weekStatusRepository.findByRestaurant_IdAndWeekStart(restaurantId, weekStart)
                .map(WeekStatus::getStatus)
                .orElse(WeekStatusType.RECEIVING);
    }

    @GetMapping("/staff-week")
    public StaffWeekResponse getStaffWeek(@RequestParam Long userId, @RequestParam LocalDate weekStart) {
        var me = CurrentUser.require();
        Long rid = me.getRestaurantId();

        var staff = userRepository.findById(userId).orElseThrow();
        if (!staff.getRestaurant().getId().equals(rid))
            throw new IllegalArgumentException("User belongs to another restaurant");

        LocalDate ws = mondayOf(weekStart);
        LocalDate we = ws.plusDays(6);

        WeekStatusType status = getStatusOrDefault(rid, ws);

        List<Preference> prefs =
                preferenceRepository.findByUser_IdAndWorkDateBetweenWithSlots(userId, ws, we);
        Map<LocalDate, Preference> map = new HashMap<>();
        for (Preference p : prefs) map.put(p.getWorkDate(), p);

        List<StaffWeekDay> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate d = ws.plusDays(i);
            Preference p = map.get(d);

            StaffWeekDay day = new StaffWeekDay();
            day.setDate(d);

            if (p == null || p.isOff() || p.getSlots().isEmpty()) {
                day.setOff(p == null || p.isOff());
                day.setSlots(Collections.emptyList());
            } else {
                day.setOff(false);
                List<SlotDto> slotDtos = new ArrayList<>();
                for (ShiftSlot s : p.getSlots()) {
                    slotDtos.add(new SlotDto(
                            s.getStartTime(),
                            s.getEndTime(),
                            s.isLast(),
                            s.getWorkplace(),
                            s.isNextDay()
                    ));
                }
                day.setSlots(slotDtos);

                // flat fields
                p.getSlots().stream()
                        .map(ShiftSlot::getStartTime)
                        .filter(Objects::nonNull)
                        .min(Comparator.naturalOrder())
                        .ifPresent(day::setStartTime);

                boolean anyLast = p.getSlots().stream().anyMatch(ShiftSlot::isLast);
                day.setLast(anyLast);
                if (!anyLast) {
                    p.getSlots().stream()
                            .map(ShiftSlot::getEndTime)
                            .filter(Objects::nonNull)
                            .max(Comparator.naturalOrder())
                            .ifPresent(day::setEndTime);
                }
            }
            days.add(day);
        }

        StaffWeekResponse res = new StaffWeekResponse();
        res.setStatus(status);
        res.setDays(days);
        return res;
    }

    @PostMapping("/staff-week/save")
    public String saveStaffWeek(
            @RequestBody ManagerStaffWeekSaveRequest req,
            @RequestParam Long userId) {
        var me = CurrentUser.require();
        return weekService.managerSaveStaffWeek(me.getRestaurantId(), userId, req);
    }
}