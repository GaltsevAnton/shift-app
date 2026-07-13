package com.shiftapp.weeks;

import com.shiftapp.common.CurrentUser;
import com.shiftapp.preferences.Preference;
import com.shiftapp.preferences.PreferenceRepository;
import com.shiftapp.preferences.ShiftSlot;
import com.shiftapp.users.UserRepository;
import com.shiftapp.users.UserRole;
import com.shiftapp.weeks.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.time.temporal.*;
import java.util.*;

@RestController
@RequestMapping("/api/manager")
@RequiredArgsConstructor
public class ManagerMonthController {

    private final WeekService            weekService;
    private final WeekStatusRepository   weekStatusRepository;
    private final UserRepository         userRepository;
    private final PreferenceRepository   preferenceRepository;

    @GetMapping("/month")
    public List<ManagerWeekResponse> getMonth(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        var me = CurrentUser.require();
        Long restaurantId = me.getRestaurantId();

        LocalDate rangeFrom, rangeTo;

        if (month != null) {
            YearMonth ym = YearMonth.parse(month);
            rangeFrom = ym.atDay(1);
            rangeTo   = ym.atEndOfMonth();
        } else if (from != null && to != null) {
            rangeFrom = LocalDate.parse(from);
            rangeTo   = LocalDate.parse(to);
            long days = ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1;
            if (days < 7)  throw new IllegalArgumentException("期間は7日以上を指定してください");
            if (days > 50) throw new IllegalArgumentException("期間は50日以内を指定してください");
        } else {
            throw new IllegalArgumentException("month または from/to を指定してください");
        }

        LocalDate rangeStart = rangeFrom.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate rangeEnd   = rangeTo.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));

        var staffList = userRepository
                .findByRestaurant_IdAndRoleInOrderByFullNameAsc(
                    restaurantId, List.of(UserRole.STAFF, UserRole.MANAGER));

        List<Preference> allPrefs = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, rangeStart, rangeEnd);

        Map<Long, Map<LocalDate, Preference>> prefsByUser = new HashMap<>();
        for (Preference p : allPrefs) {
            prefsByUser
                .computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                .put(p.getWorkDate(), p);
        }

        List<WeekStatus> statuses = weekStatusRepository
                .findByRestaurant_IdAndWeekStartBetween(restaurantId, rangeStart, rangeEnd);
        Map<LocalDate, WeekStatusType> statusMap = new HashMap<>();
        for (WeekStatus ws : statuses) {
            statusMap.put(ws.getWeekStart(), ws.getStatus());
        }

        List<ManagerWeekResponse> result = new ArrayList<>();
        LocalDate cursor = rangeStart;

        while (!cursor.isAfter(rangeTo)) {
            LocalDate weekStart = cursor;
            LocalDate weekEnd   = cursor.plusDays(6);

            WeekStatusType status = statusMap.getOrDefault(weekStart, WeekStatusType.RECEIVING);

            List<ManagerStaffWeekRow> rows = new ArrayList<>();
            for (var user : staffList) {
                Map<LocalDate, Preference> userPrefs =
                        prefsByUser.getOrDefault(user.getId(), Collections.emptyMap());

                List<StaffWeekDay> days = new ArrayList<>();
                for (int i = 0; i < 7; i++) {
                    LocalDate date = weekStart.plusDays(i);
                    Preference p   = userPrefs.get(date);
                    days.add(buildDayForManager(date, p));
                }

                ManagerStaffWeekRow row = new ManagerStaffWeekRow();
                row.setUserId(user.getId());
                row.setUserName(user.getFullName());
                row.setDays(days);
                rows.add(row);
            }

            ManagerWeekResponse resp = new ManagerWeekResponse();
            resp.setWeekStart(weekStart);
            resp.setWeekEnd(weekEnd);
            resp.setStatus(status);
            resp.setRows(rows);
            result.add(resp);

            cursor = cursor.plusWeeks(1);
        }

        return result;
    }

    private StaffWeekDay buildDayForManager(LocalDate date, Preference p) {
        StaffWeekDay day = new StaffWeekDay();
        day.setDate(date);

        if (p == null || p.isOff() || p.getSlots().isEmpty()) {
            day.setOff(p == null || p.isOff());
            day.setSlots(Collections.emptyList());
            return day;
        }

        day.setOff(false);

        List<SlotDto> slotDtos = new ArrayList<>();
        for (ShiftSlot s : p.getSlots()) {
            slotDtos.add(new SlotDto(
                    s.getStartTime(),
                    s.getEndTime(),
                    s.isLast(),
                    s.getWorkplace(),
                    s.isNextDay(),
                    s.getBreakOverrideMinutes()
            ));
        }
        day.setSlots(slotDtos);

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

        return day;
    }
}