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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
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
    public List<ManagerWeekResponse> getMonth(@RequestParam String month) {
        var me = CurrentUser.require();
        Long restaurantId = me.getRestaurantId();

        YearMonth ym       = YearMonth.parse(month);
        LocalDate firstDay = ym.atDay(1);
        LocalDate lastDay  = ym.atEndOfMonth();

        LocalDate rangeStart = firstDay.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate rangeEnd   = lastDay.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));

        // ── 1. Один запрос: все сотрудники ресторана ──
        var staffList = userRepository
                .findByRestaurant_IdAndRoleOrderByFullNameAsc(restaurantId, UserRole.STAFF);

        // ── 2. Один запрос: все preferences + slots за весь диапазон ──
        List<Preference> allPrefs = preferenceRepository
                .findByRestaurant_IdAndWorkDateBetweenWithSlots(restaurantId, rangeStart, rangeEnd);

        // Индексируем: userId → date → preference
        Map<Long, Map<LocalDate, Preference>> prefsByUser = new HashMap<>();
        for (Preference p : allPrefs) {
            prefsByUser
                .computeIfAbsent(p.getUser().getId(), k -> new HashMap<>())
                .put(p.getWorkDate(), p);
        }

        // ── 3. Один запрос: все статусы недель за диапазон ──
        List<WeekStatus> statuses = weekStatusRepository
                .findByRestaurant_IdAndWeekStartBetween(restaurantId, rangeStart, rangeEnd);
        Map<LocalDate, WeekStatusType> statusMap = new HashMap<>();
        for (WeekStatus ws : statuses) {
            statusMap.put(ws.getWeekStart(), ws.getStatus());
        }

        // ── 4. Собираем ответ по неделям ──
        List<ManagerWeekResponse> result = new ArrayList<>();
        LocalDate cursor = rangeStart;

        while (!cursor.isAfter(lastDay)) {
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

    /* ── buildDayForManager (копия из WeekService) ── */
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
                    s.isLast() ? null : s.getEndTime(),
                    s.isLast(),
                    s.getWorkplace()
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

        return day;
    }
}